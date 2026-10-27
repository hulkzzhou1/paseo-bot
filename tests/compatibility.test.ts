import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { assertPluginCompatibility } from "@getpaseo/protocol/plugin-requirements";

const manifest = JSON.parse(
  readFileSync(new URL("../paseo-plugin.json", import.meta.url), "utf8"),
);

test("the published manifest admits the baseline and newer Paseo apps and daemons", () => {
  for (const runtime of ["app", "daemon"] as const) {
    for (const version of ["0.13.2", "0.14.0-beta.1", "0.14.0", "1.0.0"]) {
      assert.doesNotThrow(() =>
        assertPluginCompatibility({
          id: manifest.id,
          requirements: manifest.requirements,
          version,
          runtime,
        }),
      );
    }
  }
});

test("the published manifest still rejects older Paseo versions", () => {
  for (const version of ["0.12.0", "0.13.1"]) {
    assert.throws(
      () =>
        assertPluginCompatibility({
          id: manifest.id,
          requirements: manifest.requirements,
          version,
          runtime: "app",
        }),
      /requires Paseo/,
    );
  }
});
