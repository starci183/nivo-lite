import { McpErrorCode } from "./errors/mcp.error"
import { McpRemoteClient, valueOfResult } from "./mcp-remote.client"
import type { McpSession } from "./mcp.contracts"

const ENDPOINT = { url: "https://hakuen.test/mcp", bearer: "s3cret" }

const sessionOf = (overrides: Partial<McpSession> = {}): McpSession => ({
    listTools: jest.fn().mockResolvedValue({ tools: [] }),
    callTool: jest.fn().mockResolvedValue({ structuredContent: { ok: true } }),
    close: jest.fn().mockResolvedValue(undefined),
    ...overrides,
})

describe("valueOfResult", () => {
    it("prefers the structured content and keeps the error flag", () => {
        expect(valueOfResult({ isError: true, structuredContent: { a: 1 } })).toEqual({
            isError: true,
            value: { a: 1 },
        })
    })

    it("reads the first text block as JSON", () => {
        const raw = { content: [{ type: "image" }, { type: "text", text: '{"holdId":"h1"}' }] }
        expect(valueOfResult(raw)).toEqual({ isError: false, value: { holdId: "h1" } })
    })

    it("keeps a text that is not a JSON object under text", () => {
        expect(valueOfResult({ content: [{ type: "text", text: "[1]" }] }).value).toEqual({ text: "[1]" })
        expect(valueOfResult({ content: [{ type: "text", text: "nope" }] }).value).toEqual({ text: "nope" })
    })

    it("answers an empty text when there is no content", () => {
        expect(valueOfResult({ content: "x" }).value).toEqual({ text: "" })
        expect(valueOfResult({ content: [{ type: "text", text: 3 }] }).value).toEqual({ text: "" })
    })
})

describe("McpRemoteClient", () => {
    it("lists the tools with defaults for a missing description or schema", async () => {
        const session = sessionOf({
            listTools: jest.fn().mockResolvedValue({
                tools: [
                    { name: "booking.hold", description: "Hold", inputSchema: { type: "object" } },
                    { name: "stay.current", inputSchema: null },
                ],
            }),
        })
        const open = jest.fn().mockResolvedValue(session)
        const tools = await new McpRemoteClient(open).listTools(ENDPOINT, 4000)
        expect(tools).toEqual([
            { name: "booking.hold", description: "Hold", inputSchema: { type: "object" } },
            { name: "stay.current", description: "", inputSchema: {} },
        ])
        expect(open).toHaveBeenCalledWith(ENDPOINT, expect.any(AbortSignal))
        expect(session.close).toHaveBeenCalled()
    })

    it("calls a tool and reads its result", async () => {
        const session = sessionOf()
        const client = new McpRemoteClient(jest.fn().mockResolvedValue(session))
        await expect(client.call(ENDPOINT, "booking.hold", { holdId: "x" }, 4000)).resolves.toEqual({
            isError: false,
            value: { ok: true },
        })
        expect(session.callTool).toHaveBeenCalledWith("booking.hold", { holdId: "x" })
    })

    it("answers unavailable when the session cannot open, and still succeeds when close fails", async () => {
        const failing = new McpRemoteClient(jest.fn().mockRejectedValue(new Error("refused")))
        await expect(failing.call(ENDPOINT, "a.b", {}, 4000)).rejects.toMatchObject({ code: McpErrorCode.Unavailable })
        const closing = sessionOf({ close: jest.fn().mockRejectedValue(new Error("gone")) })
        await expect(
            new McpRemoteClient(jest.fn().mockResolvedValue(closing)).call(ENDPOINT, "a.b", {}, 4000),
        ).resolves.toEqual({ isError: false, value: { ok: true } })
    })

    it("answers timeout when the session cannot even open in time", async () => {
        jest.useFakeTimers()
        try {
            const open = jest.fn(
                () =>
                    new Promise<McpSession>((_resolve, reject) => {
                        setTimeout(() => reject(new Error("aborted")), 9000)
                    }),
            )
            const pending = new McpRemoteClient(open).listTools(ENDPOINT, 4000)
            const settled = expect(pending).rejects.toMatchObject({ code: McpErrorCode.Timeout })
            await jest.advanceTimersByTimeAsync(9000)
            await settled
        } finally {
            jest.useRealTimers()
        }
    })

    it("aborts a call slower than the limit and answers timeout", async () => {
        jest.useFakeTimers()
        try {
            const session = sessionOf({
                callTool: jest.fn(
                    () =>
                        new Promise((_resolve, reject) => {
                            setTimeout(() => reject(new Error("aborted")), 10_000)
                        }),
                ),
            })
            const pending = new McpRemoteClient(jest.fn().mockResolvedValue(session)).call(ENDPOINT, "a.b", {}, 4000)
            const settled = expect(pending).rejects.toMatchObject({ code: McpErrorCode.Timeout })
            await jest.advanceTimersByTimeAsync(10_000)
            await settled
        } finally {
            jest.useRealTimers()
        }
    })
})
