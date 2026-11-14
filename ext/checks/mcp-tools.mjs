#!/usr/bin/env node
// ext/manifest.json check `mcp-tools` (doc ext/docs/checks/mcp-tools.md): the committed contract snapshot of the outbound MCP surface
// (`be/contracts/mcp/nivo-mcp@2.tools.json`) equals what the declarations render, and the rendered tool list keeps the surface's law (few
// tools, client-safe names, object schemas, every annotation). No database, no network. No arguments; exit 0 green.
// It BUILDS FIRST (the renderer reads the built @nivo-lite/agent-sdk, built alone: it has no workspace dependency).
// Concept: .starciwork/concepts/mcp.md.
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { toolFindings } from "../support/mcp-tools-rules.mjs"
import { ROOT, buildPackage, node } from "../support/program.mjs"

const SNAPSHOT = "be/contracts/mcp/nivo-mcp@2.tools.json"

const built = buildPackage("@nivo-lite/agent-sdk")
if (built !== 0) {
    console.error("mcp tools: @nivo-lite/agent-sdk does not build, so the declarations cannot be rendered (see the build output above)")
    process.exit(built)
}
const drift = node("scripts/mcp-tools.mjs", "--check")
const found = toolFindings(JSON.parse(readFileSync(join(ROOT, SNAPSHOT), "utf8")))
for (const finding of found) console.error(`mcp tools: ${finding}`)
if (found.length > 0) console.error(`mcp tools: ${found.length} finding(s)`)
process.exitCode = drift !== 0 ? drift : found.length > 0 ? 1 : 0
