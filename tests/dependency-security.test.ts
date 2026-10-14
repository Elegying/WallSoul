import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

// Exercise the copy resolved by the build tool, rather than adding a direct dependency.
const require = createRequire(import.meta.url);
const requireFromPostcss = createRequire(require.resolve("postcss"));
const { SourceMapConsumer } = requireFromPostcss("source-map-js");
const basicMap = { version: 3, sources: ["input.js"], names: [], mappings: "AAAA" };

function indexedMap(line: number, map: object = basicMap) {
  return { version: 3, sections: [{ offset: { line, column: 0 }, map }] };
}

test("source maps reject enormous offsets before synchronous expansion", () => {
  assert.throws(() => new SourceMapConsumer(indexedMap(1e12)), /must not exceed/);
  assert.throws(() => new SourceMapConsumer(indexedMap(Infinity)), /non-negative integers/);
});

test("nested source maps cannot bypass the cumulative offset limit", () => {
  const nested = indexedMap(5e6, indexedMap(5e6, indexedMap(5e6)));
  assert.throws(() => new SourceMapConsumer(nested), /including offsets of nested sections/);
});

test("valid indexed source maps retain their original source position", () => {
  const consumer = new SourceMapConsumer(indexedMap(2));
  const positions: object[] = [];
  consumer.eachMapping((mapping: { generatedLine: number; source: string; originalLine: number }) => {
    positions.push({ line: mapping.generatedLine, source: mapping.source, original: mapping.originalLine });
  });
  assert.deepEqual(positions, [{ line: 3, source: "input.js", original: 1 }]);
});
