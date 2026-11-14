// The decisions of the project check `mcp-tools` (ext/support/mcp-tools-rules.mjs) on fixtures.
import { strict as assert } from "node:assert"
import { test } from "node:test"
import { TOOLS_MAX, toolFindings } from "../support/mcp-tools-rules.mjs"

const tool = (name, hints = {}) => ({
    name,
    description: "Search the workspace's contacts.",
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false, ...hints },
})

test("a surface that keeps the law: no finding", () => {
    assert.deepEqual(toolFindings({ tools: [tool("nivo_search_ops"), tool("nivo_call", { readOnlyHint: false, destructiveHint: true })] }), [])
})

test("a dotted, spaced or repeated name is a finding", () => {
    const found = toolFindings({ tools: [tool("nivo.tool.contact.get"), tool("nivo contact"), tool("nivo_call"), tool("nivo_call")] })
    assert.equal(found.filter((finding) => finding.includes("client-safe")).length, 2)
    assert.ok(found.some((finding) => finding === "nivo_call: listed twice"))
})

test("a missing annotation, a non-object schema and a read-only destructive tool are findings", () => {
    const broken = { ...tool("nivo_contact_get"), inputSchema: { type: "string" }, annotations: { readOnlyHint: true, destructiveHint: true } }
    assert.deepEqual(toolFindings({ tools: [broken] }), [
        "nivo_contact_get: inputSchema is no object schema",
        "nivo_contact_get: annotation idempotentHint missing",
        "nivo_contact_get: annotation openWorldHint missing",
        "nivo_contact_get: read-only and destructive at once",
    ])
})

test("no tool, or one tool per op, is a finding", () => {
    assert.deepEqual(toolFindings({ tools: [] }), ["the contract lists no tool"])
    const many = Array.from({ length: TOOLS_MAX + 1 }, (_, at) => tool(`nivo_op_${at}`))
    assert.ok(toolFindings({ tools: many })[0].startsWith(`the contract lists ${TOOLS_MAX + 1} tools`))
})
