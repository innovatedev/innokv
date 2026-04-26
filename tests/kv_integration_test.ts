import { assertEquals, assert } from "jsr:@std/assert@1";
import { ValueCodec } from "../lib/ValueCodec.ts";

Deno.test("Deno KV Integration - Round-trip complex values", async () => {
  const kv = await Deno.openKv(":memory:");
  
  const original = {
    str: "hello",
    num: 1.23,
    nan: NaN,
    inf: Infinity,
    ninf: -Infinity,
    bool: true,
    big: 12345678901234567890n,
    date: new Date("2024-01-01T00:00:00Z"),
    u8: new Uint8Array([1, 2, 3]),
    f64: new Float64Array([1.1, 2.2]),
    b64: new BigInt64Array([100n, 200n]),
    map: new Map<unknown, unknown>([["a", 1], [1, "a"]]),
    set: new Set([1, 2, 3]),
    regexp: /test/gi,
    error: new Error("boom"),
    kvu64: new Deno.KvU64(100n),
    nested: {
      arr: [1, { x: 2 }]
    }
  };

  // 1. Encode for transport (simulating UI/API)
  const encoded = ValueCodec.encode(original);
  
  // 2. Decode (simulating backend receiving from UI)
  const decoded = ValueCodec.decode(encoded);
  
  // 3. Save to actual Deno KV
  const key = ["integration_test"];
  await kv.set(key, decoded);
  
  // 4. Read back from Deno KV
  const res = await kv.get(key);
  // deno-lint-ignore no-explicit-any
  const back = res.value as any;

  // 5. Assertions
  assertEquals(back.str, original.str);
  assertEquals(back.num, original.num);
  assert(Number.isNaN(back.nan));
  assertEquals(back.inf, Infinity);
  assertEquals(back.ninf, -Infinity);
  assertEquals(back.big, original.big);
  assertEquals(back.date.getTime(), original.date.getTime());
  assert(back.u8 instanceof Uint8Array);
  assertEquals(Array.from(back.u8), [1, 2, 3]);
  assert(back.f64 instanceof Float64Array);
  assertEquals(back.f64[0], 1.1);
  assert(back.b64 instanceof BigInt64Array);
  assertEquals(back.b64[0], 100n);
  assert(back.map instanceof Map);
  assertEquals(back.map.get("a"), 1);
  assert(back.set instanceof Set);
  assert(back.set.has(2));
  assert(back.regexp instanceof RegExp);
  assertEquals(back.regexp.source, "test");
  assertEquals(back.regexp.flags, "gi");
  assert(back.error instanceof Error);
  assertEquals(back.error.message, "boom");
  
  // NOTE: Deno KV currently only preserves Deno.KvU64 as a native instance 
  // when it is the TOP-LEVEL value. When nested in an object, it becomes 
  // a plain object { value: bigint }.
  assertEquals(back.kvu64.value, 100n);

  // 6. Test top-level KvU64 (where it SHOULD stay native)
  const u64Key = ["top_level_u64"];
  await kv.set(u64Key, new Deno.KvU64(500n));
  const u64Res = await kv.get(u64Key);
  assert(u64Res.value instanceof Deno.KvU64);
  assertEquals((u64Res.value as Deno.KvU64).value, 500n);

  assertEquals(back.nested.arr[1].x, 2);

  await kv.close();
});

Deno.test("Deno KV Integration - Key fidelity", async () => {
  const kv = await Deno.openKv(":memory:");
  
  const complexKey: Deno.KvKey = [
    "string",
    123,
    45.67,
    true,
    false,
    12345678901234567890n,
    new Uint8Array([1, 2, 3]),
    NaN,
    Infinity,
    -Infinity
  ];
  
  await kv.set(complexKey, "fidelity-test");
  
  // 1. Get exact key
  const res = await kv.get(complexKey);
  assertEquals(res.value, "fidelity-test");
  assertEquals(res.key, complexKey);

  // 2. Test list with prefix
  const iter = kv.list({ prefix: ["string", 123] });
  const entry = await iter.next();
  assert(!entry.done);
  assertEquals(entry.value.key, complexKey);

  await kv.close();
});
