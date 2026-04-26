import { assert, assertEquals } from "jsr:@std/assert@1";
import { KeyCodec } from "../lib/KeyCodec.ts";
import { ValueCodec } from "../lib/ValueCodec.ts";
import { resolvePath } from "../cli/utils.ts";

Deno.test("Type Fidelity - KeyCodec", async (t) => {
  const cases: [unknown[], string][] = [
    [["string"], '"string"'],
    [[123], "123"],
    [[true], "true"],
    [[false], "false"],
    [[123n], "123n"],
    [[new Uint8Array([1, 2, 3])], "u8[1,2,3]"],
    [["path/with/slash"], '"path/with/slash"'],
    [['quoted "string"'], '"quoted \\"string\\""'],
    [[NaN], "NaN"],
    [[Infinity], "Infinity"],
  ];

  for (const [native, encoded] of cases) {
    await t.step(`Encode ${typeof native[0]}: ${String(native[0])}`, () => {
      const apiParts = native.map((p) => ({
        type: p instanceof Uint8Array ? "Uint8Array" : typeof p,
        value: p instanceof Uint8Array
          ? Array.from(p)
          : (typeof p === "bigint" ? String(p) : p),
      } as Record<string, unknown>));
      assertEquals(KeyCodec.encode(apiParts as any), encoded);
    });

    await t.step(`Decode ${encoded}`, () => {
      const decoded = KeyCodec.decode(encoded);
      const backToNative = KeyCodec.toNative(decoded);
      assertEquals(backToNative, native);
    });
  }
});

Deno.test("Type Fidelity - ValueCodec", async (t) => {
  const complexValue = {
    str: "hello",
    num: 123.45,
    bool: true,
    big: 12345678901234567890n,
    date: new Date("2024-01-01T00:00:00Z"),
    u8: new Uint8Array([1, 2, 3]),
    i16: new Int16Array([-1, 0, 1]),
    f64: new Float64Array([1.2, 3.4]),
    map: new Map<unknown, unknown>([
      ["key", "val"],
      [1, 2],
      [new Date("2024-01-01T00:00:00Z"), "date-key"],
      [new Uint8Array([1, 2]), "u8-key"],
    ]),
    set: new Set([1, 2, 3, { a: 1 }]),
    regexp: /foo/gi,
    error: new Error("fail", { cause: new Error("inner") }),
    null: null,
    undef: undefined,
    i32: new Int32Array([100, 200]),
    b64: new BigInt64Array([100n, 200n]),
    nested: {
      a: [1, 2n, { b: 3 }],
    },
    // deno-lint-ignore no-explicit-any
    kvu64: new (globalThis as any).Deno.KvU64(100n),
  };

  await t.step("Encode and Decode complex value", () => {
    const encoded = ValueCodec.encode(complexValue);
    // deno-lint-ignore no-explicit-any
    const decoded = ValueCodec.decode(encoded) as any;

    assertEquals(decoded.str, complexValue.str);
    assertEquals(decoded.num, complexValue.num);
    assertEquals(decoded.big, complexValue.big);
    assertEquals(decoded.date.getTime(), complexValue.date.getTime());
    assert(decoded.u8 instanceof Uint8Array);
    assertEquals(Array.from(decoded.u8), [1, 2, 3]);
    assert(decoded.i16 instanceof Int16Array);
    assertEquals(Array.from(decoded.i16), [-1, 0, 1]);
    assert(decoded.i32 instanceof Int32Array);
    assertEquals(Array.from(decoded.i32), [100, 200]);
    assert(decoded.b64 instanceof BigInt64Array);
    assertEquals(Array.from(decoded.b64), [100n, 200n]);
    assert(decoded.map instanceof Map);
    assertEquals(decoded.map.get("key"), "val");

    let foundDateKey = false;
    let foundU8Key = false;
    for (const [mk, mv] of decoded.map) {
      if (
        mk instanceof Date &&
        mk.getTime() === new Date("2024-01-01T00:00:00Z").getTime()
      ) {
        foundDateKey = true;
        assertEquals(mv, "date-key");
      }
      if (mk instanceof Uint8Array && mk[0] === 1 && mk[1] === 2) {
        foundU8Key = true;
        assertEquals(mv, "u8-key");
      }
    }
    assert(foundDateKey, "Should have found Date key in Map");
    assert(foundU8Key, "Should have found Uint8Array key in Map");

    assert(decoded.set instanceof Set);
    assert(decoded.set.has(2));
    assert(decoded.regexp instanceof RegExp);
    assertEquals(decoded.regexp.source, "foo");
    assertEquals(decoded.regexp.flags, "gi");
    assert(decoded.error instanceof Error);
    assertEquals(decoded.error.message, "fail");
    assert(decoded.error.cause instanceof Error);
    assertEquals(decoded.error.cause.message, "inner");
    // deno-lint-ignore no-explicit-any
    assert(decoded.kvu64 instanceof (globalThis as any).Deno.KvU64);
    assertEquals(decoded.kvu64.value, 100n);
    assertEquals(decoded.nested.a[1], 2n);
  });
});

Deno.test("Type Fidelity - resolvePath", async (t) => {
  await t.step("Resolve path with complex parts", () => {
    const path = '"a"/123/true/123n/u8[1,2,3]/..';
    const resolved = resolvePath([], path);

    assertEquals(resolved.length, 4);
    assertEquals(resolved[0], "a");
    assertEquals(resolved[1], 123);
    assertEquals(resolved[2], true);
    assertEquals(resolved[3], 123n);
    // u8[1,2,3] was popped by ..
  });

  await t.step("Resolve absolute path", () => {
    const path = '/"root"/"sub"';
    const resolved = resolvePath(["old", "path"], path);
    assertEquals(resolved, ["root", "sub"]);
  });
});
