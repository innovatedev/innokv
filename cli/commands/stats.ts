import { Command } from "@cliffy/command";
import { Table } from "@cliffy/table";
import { formatSize } from "@/lib/utils.ts";
import { doStats } from "../actions.ts";

export const stats = new Command()
  .description("Perform a statistics scan on a database")
  .arguments("<id:string> [path:string]")
  .option("-p, --path <path:string>", "Optional sub-prefix to scan")
  .option("-t, --timeout <sec:number>", "Override scan timeout in seconds")
  .option("-j, --json", "Output raw JSON stats")
  .action(async (options, id, path) => {
    const targetPath = path || options.path;
    console.log(`Starting scan for database: ${id}...`);
    if (targetPath) console.log(`Path: ${targetPath}`);

    try {
      const result = await doStats(
        id,
        targetPath,
        options.timeout ? options.timeout * 1000 : undefined,
      );

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log("\n%cScan Complete!", "color: green; font-weight: bold");

        const summaryTable = new Table()
          .border(true)
          .body([
            ["Total Records", result.recordCount.toLocaleString()],
            ["Total Size", formatSize(result.sizeBytes)],
            ["Last Updated", result.updatedAt.toISOString()],
            [
              "Status",
              result.isPartial ? "⚠️ PARTIAL (Timed Out)" : "✅ COMPLETE",
            ],
          ]);
        summaryTable.render();

        console.log(
          "\n%cType Breakdown",
          "font-weight: bold; text-decoration: underline",
        );
        const breakdownTable = new Table()
          .header(["Type", "Count"])
          .border(true)
          .body(
            Object.entries(result.breakdown || []).map((
              [type, count],
            ) => [type, count.toLocaleString()]),
          );
        breakdownTable.render();

        if (result.topChildren?.length) {
          console.log(
            "\n%cTop Nodes (by size)",
            "font-weight: bold; text-decoration: underline",
          );
          const nodesTable = new Table()
            .header(["#", "Node", "Records", "Size"])
            .border(true)
            .body(result.topChildren.map((child, i) => [
              (i + 1).toString(),
              JSON.stringify(child.key.value),
              child.count.toLocaleString(),
              formatSize(child.size),
            ]));
          nodesTable.render();
        }
      }
    } catch (err) {
      console.error("\n%cScan Failed!", "color: red; font-weight: bold");
      console.error(err instanceof Error ? err.message : String(err));
      Deno.exit(1);
    }
  });
