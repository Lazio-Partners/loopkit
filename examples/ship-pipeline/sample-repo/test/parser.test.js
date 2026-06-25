import test from "node:test";
import assert from "node:assert/strict";
import { parseList } from "../src/parser.js";

test("parseList handles empty input", () => {
  assert.deepEqual(parseList(""), []);
});
