import { Test } from "@nestjs/testing"
import type { McpJson, McpSurface } from "./mcp.contracts"
import { McpServerService } from "./mcp-server.service"

const TOOLS = [{ name: "gateway.search", description: "Find tools.", inputSchema: { properties: {} } }]

const surfaceOf = (call: McpSurface["call"]): McpSurface => ({ tools: TOOLS, call })

const build = async (): Promise<McpServerService> => {
    const moduleRef = await Test.createTestingModule({ providers: [McpServerService] }).compile()
    return moduleRef.get(McpServerService)
}

const request = (id: number, method: string, params?: McpJson): McpJson => ({
    jsonrpc: "2.0",
    id,
    method,
    ...(params === undefined ? {} : { params }),
})

describe("McpServerService protocol", () => {
    it("answers initialize with the gateway's server info and the tools capability", async () => {
        const server = await build()
        const call = jest.fn<ReturnType<McpSurface["call"]>, Parameters<McpSurface["call"]>>()

        const reply = await server.answer({
            message: request(1, "initialize", {
                protocolVersion: "2025-06-18",
                capabilities: {},
                clientInfo: { name: "agent", version: "1" },
            }),
            surface: surfaceOf(call),
        })

        expect(reply.body).toMatchObject({
            jsonrpc: "2.0",
            id: 1,
            result: {
                protocolVersion: "2025-06-18",
                capabilities: { tools: {} },
                serverInfo: { name: "nivo-mcp-gateway" },
            },
        })
        expect(call).not.toHaveBeenCalled()
    })

    it("lists the surface tools as object schemas", async () => {
        const server = await build()

        const reply = await server.answer({ message: request(2, "tools/list"), surface: surfaceOf(jest.fn()) })

        expect(reply.body).toEqual({
            jsonrpc: "2.0",
            id: 2,
            result: {
                tools: [
                    {
                        name: "gateway.search",
                        description: "Find tools.",
                        inputSchema: { properties: {}, type: "object" },
                    },
                ],
            },
        })
    })

    it("answers a method it does not serve with the JSON-RPC error", async () => {
        const server = await build()

        const reply = await server.answer({ message: request(3, "resources/list"), surface: surfaceOf(jest.fn()) })

        expect(reply.body).toMatchObject({ jsonrpc: "2.0", id: 3, error: { code: -32601 } })
    })

    it("accepts a notification with nothing to answer and refuses a body that is not one message", async () => {
        const server = await build()
        const call = jest.fn<ReturnType<McpSurface["call"]>, Parameters<McpSurface["call"]>>()

        await expect(
            server.answer({
                message: { jsonrpc: "2.0", id: undefined, method: "notifications/initialized", params: undefined },
                surface: surfaceOf(call),
            }),
        ).resolves.toEqual({ body: null })
        await expect(server.answer({ message: [request(4, "tools/list")], surface: surfaceOf(call) })).resolves.toEqual(
            {
                body: { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid Request" } },
            },
        )
        expect(call).not.toHaveBeenCalled()
    })
})

describe("McpServerService tool argument validation", () => {
    it("hands the original arguments to domain validation without dropping prototype-named JSON members", async () => {
        const server = await build()
        const call = jest.fn<ReturnType<McpSurface["call"]>, Parameters<McpSurface["call"]>>()
        call.mockResolvedValue({ value: { error: "invalid_arguments" }, isError: true })
        const nested = Object.fromEntries([["__proto__", { hidden: true }]])
        const args: McpJson = { name: "tool", arguments: nested }

        await server.answer({
            message: request(9, "tools/call", { name: "tool.call", arguments: args }),
            surface: surfaceOf(call),
        })

        expect(call.mock.calls[0]?.[1]).toBe(args)
        expect(call).toHaveBeenCalledWith("tool.call", args)
        expect(call.mock.calls[0]?.[1].arguments).toBe(nested)
    })

    it("returns the MCP tool error shape for invalid arguments", async () => {
        const server = await build()
        const call = jest.fn<ReturnType<McpSurface["call"]>, Parameters<McpSurface["call"]>>()
        call.mockResolvedValue({ value: { error: "invalid_arguments" }, isError: true })

        await expect(
            server.answer({
                message: request(7, "tools/call", { name: "tool.search", arguments: { query: "spa", limit: 11 } }),
                surface: surfaceOf(call),
            }),
        ).resolves.toEqual({
            body: {
                jsonrpc: "2.0",
                id: 7,
                result: {
                    content: [{ type: "text", text: '{"error":"invalid_arguments"}' }],
                    structuredContent: { error: "invalid_arguments" },
                    isError: true,
                },
            },
        })
    })

    it("rejects a non-object argument envelope as invalid JSON-RPC parameters before dispatch", async () => {
        const server = await build()
        const call = jest.fn<ReturnType<McpSurface["call"]>, Parameters<McpSurface["call"]>>()

        const reply = await server.answer({
            message: request(8, "tools/call", { name: "tool.search", arguments: ["spa"] }),
            surface: surfaceOf(call),
        })

        expect(reply.body).toMatchObject({ jsonrpc: "2.0", id: 8, error: { code: -32602 } })
        expect(call).not.toHaveBeenCalled()
    })
})

describe("McpServerService tools/call", () => {
    it("runs the tool with its arguments and answers its JSON as structured and text content", async () => {
        const server = await build()
        const call = jest.fn<ReturnType<McpSurface["call"]>, Parameters<McpSurface["call"]>>()
        call.mockResolvedValue({ value: { tools: [] }, isError: false })

        const reply = await server.answer({
            message: request(5, "tools/call", { name: "gateway.search", arguments: { query: "spa" } }),
            surface: surfaceOf(call),
        })

        expect(call).toHaveBeenCalledWith("gateway.search", { query: "spa" })
        expect(reply.body).toEqual({
            jsonrpc: "2.0",
            id: 5,
            result: {
                content: [{ type: "text", text: '{"tools":[]}' }],
                structuredContent: { tools: [] },
                isError: false,
            },
        })
    })

    it("runs a call without arguments with an empty object and keeps the error flag", async () => {
        const server = await build()
        const call = jest.fn<ReturnType<McpSurface["call"]>, Parameters<McpSurface["call"]>>()
        call.mockResolvedValue({ value: { error: "unknown_tool" }, isError: true })

        const reply = await server.answer({
            message: request(6, "tools/call", { name: "gateway.nope" }),
            surface: surfaceOf(call),
        })

        expect(call).toHaveBeenCalledWith("gateway.nope", {})
        expect(reply.body).toMatchObject({
            id: 6,
            result: { structuredContent: { error: "unknown_tool" }, isError: true },
        })
    })
})
