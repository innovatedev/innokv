import { serialize } from "node:v8";

const data = { a: 1, b: "hello", c: new Uint8Array([1, 2, 3]) };
const buf = serialize(data);
console.log("Size:", buf.byteLength);
