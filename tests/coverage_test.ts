import { KeySerialization } from "@/lib/KeySerialization.ts";
import { KeyCodec } from "@/lib/KeyCodec.ts";
import { ValueCodec } from "@/lib/ValueCodec.ts";
import { ApiKvKeyPart } from "@/lib/types.ts";
import { assert, assertEquals } from "jsr:@std/assert@1";

Deno.test("Full Type Coverage - Keys (Strict)", () => {
  const types: Deno.KvKeyPart[] = [
    "string",
    123,
    true,
    false,
    100n,
    new Uint8Array([1, 2, 3]),
    NaN,
    Infinity,
  ];

  for (const t of types) {
    const serialized = KeySerialization.serialize(t);
    const parsed = KeySerialization.parse(serialized);

    if (t instanceof Uint8Array) {
      assert(parsed instanceof Uint8Array);
      assertEquals(Array.from(parsed as Uint8Array), Array.from(t));
    } else if (typeof t === "number" && isNaN(t)) {
      assert(typeof parsed === "number" && isNaN(parsed));
    } else {
      assertEquals(t, parsed);
    }
  }
});

Deno.test("KeyCodec Path Representation Coverage - Shorthands", () => {
  const testCases: { parts: ApiKvKeyPart[]; path: string }[] = [
    {
      parts: [{ type: "string", value: "simple" }],
      path: '"simple"',
    },
    {
      parts: [{ type: "string", value: 'with "quotes"' }],
      path: '"with \\"quotes\\""',
    },
    {
      parts: [{ type: "number", value: 123.45 }],
      path: "123.45",
    },
    {
      parts: [{ type: "number", value: NaN }],
      path: "NaN",
    },
    {
      parts: [{ type: "number", value: Infinity }],
      path: "Infinity",
    },
    {
      parts: [{ type: "bigint", value: "9007199254740991" }],
      path: "9007199254740991n",
    },
    {
      parts: [{ type: "boolean", value: true }, {
        type: "boolean",
        value: false,
      }],
      path: "true/false",
    },
    {
      parts: [{ type: "Uint8Array", value: [1, 2, 3] }],
      path: "u8[1,2,3]",
    },
    {
      parts: [{ type: "Uint8Array", value: [] }],
      path: "u8[]",
    },
    {
      parts: [
        { type: "string", value: "user" },
        { type: "number", value: 1 },
        { type: "Uint8Array", value: [255] },
      ],
      path: '"user"/1/u8[255]',
    },
  ];

  for (const { parts, path } of testCases) {
    // Test Encode
    const encoded = KeyCodec.encode(parts);
    assertEquals(encoded, path);

    // Test Decode
    const decoded = KeyCodec.decode(encoded);
    assertEquals(decoded, parts);
  }

  // Test unquoted string fallback (Decode only)
  const unquoted = "user/1/u8[255]";
  const decoded = KeyCodec.decode(unquoted);
  assertEquals(decoded, [
    { type: "string", value: "user" },
    { type: "number", value: 1 },
    { type: "Uint8Array", value: [255] },
  ]);
});

Deno.test("Full Type Coverage - Values", () => {
  const now = new Date();
  const values = [
    "hello",
    42,
    3.14,
    NaN,
    Infinity,
    -Infinity,
    true,
    false,
    9007199254740991n,
    undefined,
    null,
    now,
    /test/gi,
    new Uint8Array([1, 2, 3]),
    new Uint8Array([4, 5, 6]).buffer,
    { a: 1, b: "two", c: [1, 2] },
    [1, "two", { three: 3 }],
    new Map<unknown, unknown>([["key", "val"], [1, 2]]),
    new Set<unknown>([1, 2, "three"]),
  ];

  for (const v of values) {
    const encoded = ValueCodec.encode(v);
    const decoded = ValueCodec.decode(encoded);

    if (v instanceof Date) {
      assert(decoded instanceof Date);
      assertEquals((decoded as Date).getTime(), v.getTime());
    } else if (v instanceof Uint8Array) {
      assert(decoded instanceof Uint8Array);
      assertEquals(Array.from(decoded as Uint8Array), Array.from(v));
    } else if (v instanceof ArrayBuffer) {
      assert(decoded instanceof ArrayBuffer);
      assertEquals(
        Array.from(new Uint8Array(decoded as ArrayBuffer)),
        Array.from(new Uint8Array(v)),
      );
    } else if (v instanceof RegExp) {
      assert(decoded instanceof RegExp);
      assertEquals(decoded.source, v.source);
      assertEquals(decoded.flags, v.flags);
    } else if (v instanceof Map) {
      assert(decoded instanceof Map);
      assertEquals(Array.from(decoded.entries()), Array.from(v.entries()));
    } else if (v instanceof Set) {
      assert(decoded instanceof Set);
      assertEquals(Array.from(decoded), Array.from(v));
    } else if (v !== v) { // NaN
      assert(decoded !== decoded);
    } else {
      assertEquals(v, decoded);
    }
  }
});
