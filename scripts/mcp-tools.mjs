#!/usr/bin/env node
// The contract snapshot of the outbound MCP surface (.starciwork/concepts/mcp.md): `be/contracts/mcp/nivo-mcp@2.tools.json`, the tool list
// the mcp app answers on `tools/list` (names, schemas, annotations, meta) and its `initialize` instructions, rendered from the declarations
// by scripts/mcp-tools.entry.ts (ts-node, be's tsconfig paths; reads the BUILT @nivo-lite/agent-sdk). No database, no network.
//
//   npm run mcp:tools          (= --write) writes the snapshot; run `npm run build:modules` first
//   npm run mcp:tools:check    (= --check) renders in memory and fails on any difference with the committed snapshot
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

const root = path.resolve(import.meta.dirname, "..")
const SNAPSHOT = "be/contracts/mcp/nivo-mcp@2.tools.json"

/** The snapshot text the declarations render now. */
export const renderTools = () => {
    const result = spawnSync(
        process.execPath,
        ["-r", "ts-node/register/transpile-only", "-r", "tsconfig-paths/register", path.join("scripts", "mcp-tools.entry.ts")],
        {
            cwd: root,
            encoding: "utf8",
            env: { ...process.env, TS_NODE_PROJECT: path.join(root, "be", "tsconfig.json"), TS_NODE_COMPILER_OPTIONS: '{"module":"commonjs","moduleResolution":"node10"}' },
            maxBuffer: 16 * 1024 * 1024,
        },
    )
    if (result.status !== 0) {
        process.stderr.write(result.stderr ?? "")
        throw new Error(`mcp tools: the renderer exited ${result.status ?? "without a status"}`)
    }
    return result.stdout
}

const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)
if (isMain) {
    const text = renderTools()
    const full = path.join(root, SNAPSHOT)
    if (process.argv.includes("--write")) {
        fs.writeFileSync(full, text, "utf8")
        console.log(`mcp tools: wrote ${SNAPSHOT} (${JSON.parse(text).tools.length} tools)`)
    } else if (process.argv.includes("--check")) {
        const committed = fs.existsSync(full) ? fs.readFileSync(full, "utf8") : null
        if (committed === text) {
            console.log(`mcp tools: ${SNAPSHOT} equals the declarations (${JSON.parse(text).tools.length} tools)`)
        } else {
            console.error(
                committed === null
                    ? `mcp tools: ${SNAPSHOT} is missing: run npm run mcp:tools`
                    : `mcp tools: ${SNAPSHOT} differs from what the declarations render: run npm run mcp:tools and review the diff`,
            )
            process.exitCode = 1
        }
    } else {
        console.error("mcp tools: pass --write or --check")
        process.exitCode = 2
    }
}
