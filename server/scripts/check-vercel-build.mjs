import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const output = process.argv[2]
  ? resolve(process.argv[2])
  : fileURLToPath(new URL("../../.vercel/output/", import.meta.url));
const api = fileURLToPath(new URL("../api/", import.meta.url));
const routes = readdirSync(api, { recursive: true }).filter((file) => file.endsWith(".ts"));
assert.ok(routes.length > 0, "No API routes found");

const isolated = mkdtempSync(join(tmpdir(), "scoutvy-vercel-"));
try {
  for (const route of routes) {
    const relative = join("api", route.replace(/\.ts$/, ".func"));
    const source = join(output, "functions", relative);
    const config = JSON.parse(readFileSync(join(source, ".vc-config.json"), "utf8"));
    assert.equal(config.runtime, `nodejs${process.versions.node.split(".")[0]}.x`,
      `Use the deployment's Node.js version to test ${relative}`);
    const target = join(isolated, relative);
    cpSync(source, target, { recursive: true, dereference: true });
    const result = spawnSync(process.execPath, ["-e", "require(process.argv[1])", join(target, config.handler)], {
      cwd: isolated,
      env: { ...process.env, NODE_PATH: "" },
      encoding: "utf8",
      timeout: 30_000,
    });
    assert.equal(result.status, 0, `${relative} failed to load in isolation:\n${result.stderr}`);
    console.log(`Loaded ${relative} without repository dependencies`);
  }
  console.log(`Verified ${routes.length} standalone functions`);
} finally {
  rmSync(isolated, { recursive: true, force: true });
}
