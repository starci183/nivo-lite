import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { GraphNodeRegistryService, type NodeEffectExecutor } from "@modules/domain/graph-nodes"
import { MESSAGE_CATALOG, type MessageCatalog } from "@modules/platform/i18n"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { PublicApiLogEvent } from "./public-api.log-events"
import { PublicMessageHoldsService, type HeldMessage } from "./public-message-holds.service"

const HELD: HeldMessage = {
    workspaceId: "ws-1",
    agentId: "agent-1",
    conversationId: "conv-1",
    requestId: "req-1",
    text: "Exact caller text\nwith its spacing.  ",
    reason: "approval_asked",
}

/** The catalogue as a test reads it: the key in brackets, so a payload names the words it was given. */
const catalog = mock<MessageCatalog>({ get: jest.fn((key: string) => `[${key}]`) })

const build = async (post: NodeEffectExecutor | undefined) => {
    const nodes = mock<GraphNodeRegistryService>({ optionalExecutorOf: jest.fn().mockReturnValue(post) })
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            PublicMessageHoldsService,
            { provide: GraphNodeRegistryService, useValue: nodes },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { holds: moduleRef.get(PublicMessageHoldsService), nodes, logger }
}

describe("PublicMessageHoldsService: a held public-API message is an unhandled case on /chat", () => {
    it("tells the founder once per request, in the agent's direct room, the exact text and why it was held", async () => {
        const post = mock<NodeEffectExecutor>({ effect: TOOL.teamMessagePost })
        post.execute.mockResolvedValue({ kind: "chat-message", id: "m-1" })
        const { holds, nodes } = await build(post)

        await holds.report(HELD)

        expect(nodes.optionalExecutorOf).toHaveBeenCalledWith(TOOL.teamMessagePost)
        const [turn, payload, call] = post.execute.mock.calls[0] ?? []
        expect(turn).toMatchObject({ workspaceId: "ws-1", agentId: "agent-1", conversationId: null, origin: "system" })
        expect(payload).toEqual({
            kind: "report.facts",
            title: "[publicApi.held.title]",
            text: "[publicApi.held.sentence]",
            audience: "founder",
            facts: [
                { name: "[teamChat.fact.why]", value: "[publicApi.held.reason.approval_asked]", technical: false },
                { name: "[publicApi.held.fact.text]", value: HELD.text, technical: false },
                { name: "[teamChat.fact.conversation]", value: "conv-1", technical: true },
            ],
        })
        expect(call).toEqual({ key: "api-message-held:req-1", dedupeKey: "api-message-held:req-1" })
    })

    it("names a message held past its auto-send window by that reason", async () => {
        const post = mock<NodeEffectExecutor>({ effect: TOOL.teamMessagePost })
        const { holds } = await build(post)

        await holds.report({ ...HELD, reason: "stale" })

        expect(post.execute.mock.calls[0]?.[1]).toMatchObject({
            facts: expect.arrayContaining([expect.objectContaining({ value: "[publicApi.held.reason.stale]" })]),
        })
    })

    it("logs, and never throws, when the team chat cannot take the report", async () => {
        const broken = mock<NodeEffectExecutor>({ effect: TOOL.teamMessagePost })
        broken.execute.mockRejectedValue(new Error("down"))
        const absent = await build(undefined)
        const failing = await build(broken)

        await expect(absent.holds.report(HELD)).resolves.toBeUndefined()
        await expect(failing.holds.report(HELD)).resolves.toBeUndefined()
        expect(absent.logger.warn).toHaveBeenCalledWith(PublicApiLogEvent.HeldReportSkipped, {
            workspaceId: "ws-1",
            requestId: "req-1",
        })
        expect(failing.logger.error).toHaveBeenCalledWith(PublicApiLogEvent.HeldReportSkipped, expect.any(Error), {
            workspaceId: "ws-1",
            requestId: "req-1",
        })
    })
})
