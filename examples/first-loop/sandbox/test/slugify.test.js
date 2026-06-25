import test from "node:test";
import assert from "node:assert/strict";
import { slugify } from "../src/slugify.js";

test("slugify trims and collapses whitespace", () => {
  assert.equal(slugify(" Hello   World "), "hello-world");
});
