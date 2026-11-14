// Renders the outbound MCP surface's tool list (`tools/list`) and server instructions as JSON on stdout, from the declarations the mcp app
// serves (be/src/modules/domain/mcp-endpoint/mcp-surface.tools.ts). Run by scripts/mcp-tools.mjs under ts-node; no Nest, no database.
import { INSTRUCTIONS, SURFACE_TOOLS } from "../be/src/modules/domain/mcp-endpoint/mcp-surface.tools"

const contract = {
    contract: "nivo-mcp@2",
    server: { name: "nivo", version: "2.0.0" },
    instructions: INSTRUCTIONS,
    tools: SURFACE_TOOLS.map((tool) => ({
        name: tool.name,
        title: tool.title,
        description: tool.description,
        inputSchema: { ...tool.inputSchema, type: "object" },
        outputSchema: { ...tool.outputSchema, type: "object" },
        annotations: tool.annotations,
        _meta: tool.meta,
    })),
}

process.stdout.write(`${JSON.stringify(contract, null, 2)}\n`)
