// What the project check `mcp-tools` (ext/checks/mcp-tools.mjs) decides about the outbound MCP surface's tool list, as pure functions over
// plain data, so its spec runs on fixtures. This file is no check: it lives in ext/support/ because the harness's R103 refuses a file of
// ext/checks/ that the manifest does not declare. Concept: .starciwork/concepts/mcp.md (few tools, good discovery; annotations on every tool).

/** The tool name every Claude client accepts (the MCP spec also allows dots; NIVO keeps to the common subset). */
const CLIENT_SAFE_NAME = /^[a-zA-Z0-9_-]{1,64}$/u

/** The most tools the surface may list: discovery plus the most used ops, never one tool per op. */
export const TOOLS_MAX = 20

/** The annotations every listed tool must carry, each a boolean. */
const HINTS = ["readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint"]

/** The findings (strings) of one rendered contract `{ tools: [...] }`; none when the surface keeps the law. */
export const toolFindings = (contract) => {
    const found = []
    const tools = Array.isArray(contract?.tools) ? contract.tools : []
    if (tools.length === 0) found.push("the contract lists no tool")
    if (tools.length > TOOLS_MAX) found.push(`the contract lists ${tools.length} tools; at most ${TOOLS_MAX} (discovery plus the most used ops)`)
    const seen = new Set()
    for (const tool of tools) {
        const name = String(tool?.name)
        if (!CLIENT_SAFE_NAME.test(name)) found.push(`${name}: not a client-safe tool name ([a-zA-Z0-9_-], 1 to 64)`)
        if (seen.has(name)) found.push(`${name}: listed twice`)
        seen.add(name)
        if (typeof tool?.description !== "string" || tool.description.length === 0) found.push(`${name}: no description`)
        for (const key of ["inputSchema", "outputSchema"]) {
            if (tool?.[key]?.type !== "object") found.push(`${name}: ${key} is no object schema`)
        }
        for (const hint of HINTS) {
            if (typeof tool?.annotations?.[hint] !== "boolean") found.push(`${name}: annotation ${hint} missing`)
        }
        if (tool?.annotations?.readOnlyHint === true && tool?.annotations?.destructiveHint === true) {
            found.push(`${name}: read-only and destructive at once`)
        }
    }
    return found
}
