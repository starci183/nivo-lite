import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { McpGatewayService } from "@modules/domain/mcp-gateway"
import type { GatewayCallResult } from "@modules/domain/mcp-gateway"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InternalReaderService } from "./internal-reader.service"

const WS = "11111111-1111-4111-8111-111111111111"
const SOURCE = "22222222-2222-4222-8222-222222222222"
const document = { id: SOURCE, title: "Delivery policy", contentHash: "h1", text: "Same day delivery." }
const answer = (value: Record<string, unknown>): GatewayCallResult => ({ ok: true, value: { notice: "n", ...value } })
const refusal = (code: "internal_only" | "not_granted" | "tool_error"): GatewayCallResult => ({
    ok: false,
    code,
    detail: code,
})

const build = async () => {
    const gateway = mock<McpGatewayService>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            InternalReaderService,
            { provide: McpGatewayService, useValue: gateway },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { reader: moduleRef.get(InternalReaderService), gateway, logger }
}

describe("InternalReaderService read", () => {
    it("reads the document as the agent granted the tool, with no conversation", async () => {
        const { reader, gateway } = await build()
        gateway.agentsGranted.mockResolvedValue(["a1"])
        gateway.call.mockResolvedValue(answer({ document }))

        await expect(reader.read(WS, SOURCE)).resolves.toEqual({
            kind: "ok",
            text: { sourceId: SOURCE, title: "Delivery policy", contentHash: "h1", text: "Same day delivery." },
        })
        expect(gateway.agentsGranted).toHaveBeenCalledWith(WS, ["brain.documents.read"])
        expect(gateway.call).toHaveBeenCalledWith(
            { workspaceId: WS, agentId: "a1", conversationId: null, workItemId: null },
            "brain.documents.read",
            { sourceId: SOURCE },
        )
    })

    it("has no right when no agent holds the tool, and calls nothing", async () => {
        const { reader, gateway } = await build()
        gateway.agentsGranted.mockResolvedValue([])

        await expect(reader.read(WS, SOURCE)).resolves.toEqual({ kind: "no_right" })
        expect(gateway.call).not.toHaveBeenCalled()
    })

    it("passes over an agent that faces customers and uses the next one", async () => {
        const { reader, gateway } = await build()
        gateway.agentsGranted.mockResolvedValue(["chatbot", "sales"])
        gateway.call.mockResolvedValueOnce(refusal("internal_only")).mockResolvedValueOnce(answer({ document }))

        await expect(reader.read(WS, SOURCE)).resolves.toMatchObject({ kind: "ok" })
        expect(gateway.call).toHaveBeenCalledTimes(2)
    })

    it("has no right when every granted agent is passed over", async () => {
        const { reader, gateway } = await build()
        gateway.agentsGranted.mockResolvedValue(["chatbot", "support"])
        gateway.call.mockResolvedValueOnce(refusal("internal_only")).mockResolvedValueOnce(refusal("not_granted"))

        await expect(reader.read(WS, SOURCE)).resolves.toEqual({ kind: "no_right" })
    })

    it("is refused, and logs it, when the tool refuses the document", async () => {
        const { reader, gateway, logger } = await build()
        gateway.agentsGranted.mockResolvedValue(["a1"])
        gateway.call.mockResolvedValue(refusal("tool_error"))

        await expect(reader.read(WS, SOURCE)).resolves.toEqual({ kind: "refused" })
        expect(logger.warn).toHaveBeenCalledWith("public_documents.read.refused", {
            tool: "brain.documents.read",
            code: "tool_error",
        })
    })

    it.each([{}, { document: "x" }, { document: { title: "T", text: "t" } }, { document: { ...document, title: 1 } }])(
        "is refused for an answer without the shape %j",
        async (value) => {
            const { reader, gateway } = await build()
            gateway.agentsGranted.mockResolvedValue(["a1"])
            gateway.call.mockResolvedValue(answer(value))

            await expect(reader.read(WS, SOURCE)).resolves.toEqual({ kind: "refused" })
        },
    )
})

describe("InternalReaderService hits", () => {
    it("names the distinct documents of the passages, best first, three at most", async () => {
        const { reader, gateway } = await build()
        gateway.agentsGranted.mockResolvedValue(["a1"])
        const passage = (sourceId: unknown) => ({ sourceId, title: "t", content: "c" })
        gateway.call.mockResolvedValue(
            answer({
                passages: [passage("s1"), passage("s2"), passage("s1"), passage(4), "x", passage("s3"), passage("s4")],
            }),
        )

        await expect(reader.hits(WS, "Do you deliver tonight?")).resolves.toEqual({
            kind: "ok",
            sourceIds: ["s1", "s2", "s3"],
        })
        expect(gateway.agentsGranted).toHaveBeenCalledWith(WS, ["brain.search"])
        expect(gateway.call).toHaveBeenCalledWith(expect.anything(), "brain.search", {
            query: "Do you deliver tonight?",
            limit: 6,
        })
    })

    it("names none for an answer with no passages", async () => {
        const { reader, gateway } = await build()
        gateway.agentsGranted.mockResolvedValue(["a1"])
        gateway.call.mockResolvedValue(answer({}))

        await expect(reader.hits(WS, "q")).resolves.toEqual({ kind: "ok", sourceIds: [] })
    })

    it("has no right without a grant", async () => {
        const { reader, gateway } = await build()
        gateway.agentsGranted.mockResolvedValue([])

        await expect(reader.hits(WS, "q")).resolves.toEqual({ kind: "no_right" })
    })
})
