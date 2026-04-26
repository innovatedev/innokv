import { Signal } from "@preact/signals";
import { ApiKvKeyPart, DbNode } from "@/lib/types.ts";
import { KeyCodec } from "@/lib/KeyCodec.ts";
import { Database } from "@/kv/models.ts";
import KvAdminClient from "@/lib/KvAdminClient.ts";
import { useEffect, useState } from "preact/hooks";

export function useDbStructure(
  activeDatabase: Database | null,
  api: KvAdminClient,
  initialStructure: Record<string, DbNode> | null | undefined,
  pathInfo: Signal<ApiKvKeyPart[] | null>,
  error: Signal<string | null>,
) {
  const [dbStructure, setDbStructure] = useState<Record<string, DbNode> | null>(
    () => initialStructure || null,
  );
  const [openPaths, setOpenPaths] = useState<Set<string>>(new Set());

  const mergeStructure = (
    currentStruct: Record<string, DbNode>,
    path: ApiKvKeyPart[],
    newChildren: Record<string, DbNode>,
    nextCursor?: string,
  ): Record<string, DbNode> => {
    const safeMergeDict = (
      current: Record<string, DbNode>,
      incoming: Record<string, DbNode>,
    ): Record<string, DbNode> => {
      const merged = { ...current };
      for (const [key, newNode] of Object.entries(incoming)) {
        if (merged[key]) {
          merged[key] = {
            ...newNode,
            children: merged[key].children,
            nextCursor: merged[key].nextCursor,
            lastLoadedCursor: merged[key].lastLoadedCursor,
          };
        } else {
          merged[key] = newNode;
        }
      }
      return merged;
    };

    if (path.length === 0) {
      return safeMergeDict(currentStruct, newChildren);
    }

    const [head, ...tail] = path;
    const headKey = KeyCodec.encode([head]);
    const node = currentStruct[headKey];

    if (!node) return currentStruct;

    if (tail.length === 0) {
      const existingChildren = node.children || {};
      const mergedChildren = safeMergeDict(existingChildren, newChildren);

      return {
        ...currentStruct,
        [headKey]: {
          ...node,
          children: mergedChildren,
          childrenCount: Object.keys(mergedChildren).length,
          lastLoadedCursor: nextCursor !== undefined
            ? nextCursor
            : node.lastLoadedCursor,
          nextCursor: nextCursor !== undefined ? nextCursor : node.nextCursor,
        },
      };
    }

    return {
      ...currentStruct,
      [headKey]: {
        ...node,
        children: mergeStructure(
          node.children || {},
          tail,
          newChildren,
          nextCursor,
        ),
      },
    };
  };

  useEffect(() => {
    if (!pathInfo.value || !activeDatabase) return;
    if (pathInfo.value.length > 0 && !dbStructure) return;

    const path = pathInfo.value;
    const dbId = activeDatabase.slug || activeDatabase.id;

    const newOpenPaths = new Set(openPaths);
    let changedOpen = false;
    const parents: ApiKvKeyPart[] = [];

    for (let i = 0; i < path.length; i++) {
      const seg = path[i];
      parents.push(seg);
      const parentStr = KeyCodec.encode(parents);

      if (!newOpenPaths.has(parentStr)) {
        newOpenPaths.add(parentStr);
        changedOpen = true;
      }
    }

    if (changedOpen) {
      setOpenPaths(newOpenPaths);
    }

    const checkAndLoad = async () => {
      let currentLevel = dbStructure;
      const currentPath: ApiKvKeyPart[] = [];

      for (let i = 0; i < path.length; i++) {
        const seg = path[i];
        const keyStr = KeyCodec.encode([seg]);
        if (!currentLevel) return;
        const node = currentLevel[keyStr];

        if (!node) {
          await api.getNodes(dbId, currentPath).then(
            (res: { items: Record<string, DbNode>; cursor?: string }) => {
              const nodes = res.items;
              if (nodes) {
                // Check if the current segment exists in the fetched nodes
                const nextKey = KeyCodec.encode([seg]);
                if (!nodes[nextKey]) {
                  pathInfo.value = [];
                  return;
                }
                setDbStructure((prev) => {
                  if (!prev) return nodes;
                  return mergeStructure(prev, currentPath, nodes, res.cursor);
                });
              }
            },
          ).catch((e: Error) => {
            console.error(e);
            error.value = e.message;
            if (pathInfo.value && pathInfo.value.length > 0) {
              pathInfo.value = [];
            }
          });
          return;
        }

        if (i < path.length) {
          if (
            node.hasChildren &&
            (!node.children || Object.keys(node.children).length === 0)
          ) {
            const nextPath = [...currentPath, seg];
            await api.getNodes(dbId, nextPath).then(
              (res: { items: Record<string, DbNode>; cursor?: string }) => {
                const nodes = res.items;
                if (nodes) {
                  setDbStructure((prev) => {
                    if (!prev) return nodes;
                    return mergeStructure(prev, nextPath, nodes, res.cursor);
                  });
                }
              },
            ).catch((e: Error) => {
              console.error(e);
              error.value = e.message;
              if (pathInfo.value && pathInfo.value.length > 0) {
                pathInfo.value = [];
              }
            });
            return;
          }
        }

        currentLevel = node.children || {};
        currentPath.push(seg);
      }
    };

    checkAndLoad();
  }, [pathInfo.value, dbStructure, activeDatabase]);

  const togglePath = (
    path: ApiKvKeyPart[],
    _isOpen: boolean,
    hasChildren: boolean,
  ) => {
    const pathStr = KeyCodec.encode(path);
    const currentlyOpen = openPaths.has(pathStr);

    setOpenPaths((prev) => {
      const newSet = new Set(prev);
      if (currentlyOpen) newSet.delete(pathStr);
      else newSet.add(pathStr);
      return newSet;
    });

    if (!currentlyOpen && hasChildren && activeDatabase) {
      const dbId = activeDatabase.slug || activeDatabase.id;
      api.getNodes(dbId, path).then(
        (res: { items: Record<string, DbNode>; cursor?: string }) => {
          const nodes = res.items;
          if (nodes && Object.keys(nodes).length > 0) {
            setDbStructure((prev) => {
              if (!prev) return nodes;
              return mergeStructure(prev, path, nodes, res.cursor);
            });
          }
        },
      );
    }
  };

  return {
    dbStructure,
    setDbStructure,
    openPaths,
    setOpenPaths,
    mergeStructure,
    togglePath,
  };
}
