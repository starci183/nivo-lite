import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { EntityManager } from "typeorm"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { TeamChatChainStopReporterService } from "./team-chat-chain-stop-reporter.service"
import { TeamChatAudienceService } from "./team-chat-audience.service"
import type { ChainStop } from "./team-chat-notice.contracts"

const WS = "11111111-1111-4111-8111-111111111111"
const AGENT = "31111111-1111-4111-8111-111111111111"
const STOP: ChainStop = { workspaceId: WS, agentId: AGENT, depth: 5, reason: "depth_limit", eventType: "order.created" }

const build = async () => {
    const audience = mock<TeamChatAudienceService>()
    audience.postTeamCard.mockResolvedValue({ messageId: "m-1", facts: {} })
    const catalog = mock<MessageCatalog>()
    catalog.get.mockReturnValue("Chu\u1ed7i agent \u0111\u00e3 d\u1eebng")
    const moduleRef = await Test.createTestingModule({
        providers: [
            TeamChatChainStopReporterService,
            { provide: TeamChatAudienceService, useValue: audience },
            { provide: MESSAGE_CATALOG, useValue: catalog },
        ],
    }).compile()
    return { reporter: moduleRef.get(TeamChatChainStopReporterService), audience, catalog }
}

const TX = mock<EntityManager>()

/** What the line key of a stopped chain looks like. */
const CHAIN_STOPPED_KEY: unknown = expect.stringMatching(/^chain-stopped:/)

describe("TeamChatChainStopReporterService", () => {
    it("says a stopped chain ONCE in the founder's direct room as the agent that was not woken, with the words from the bundle", async () => {
        const { reporter, audience, catalog } = await build()

        await reporter.report(TX, STOP)

        expect(catalog.get).toHaveBeenCalledWith(
            "teamChat.chainStopped",
            { depth: 5, reason: "depth_limit", eventType: "order.created" },
            "vi",
        )
        expect(audience.postTeamCard).toHaveBeenCalledTimes(1)
        expect(audience.postTeamCard).toHaveBeenCalledWith(WS, {
            agentId: AGENT,
            audience: "founder",
            key: CHAIN_STOPPED_KEY,
            message: {
                kind: "chain.stopped",
                intent: "notify",
                title: "chain.stopped",
                summary: "Chu\u1ed7i agent \u0111\u00e3 d\u1eebng",
                payload: { version: 1, depth: 5, reason: "depth_limit", eventType: "order.created" },
                options: [],
            },
        })
    })

    it("keys the line by agent, depth, reason and event type: a redelivered stop is the same line, another event is not", async () => {
        const { reporter, audience } = await build()

        await reporter.report(TX, STOP)
        await reporter.report(TX, STOP)
        await reporter.report(TX, { ...STOP, eventType: "payment.received" })

        const keys = audience.postTeamCard.mock.calls.map(([, post]) => post.key)
        expect(keys[0]).toBe(keys[1])
        expect(keys[2]).not.toBe(keys[0])
    })

    it("lets a refusal of the chat reach the door, so the delivery rolls back and the sender retries", async () => {
        const { reporter, audience } = await build()
        audience.postTeamCard.mockRejectedValue(new Error("chat down"))

        await expect(reporter.report(TX, STOP)).rejects.toThrow("chat down")
    })
})
