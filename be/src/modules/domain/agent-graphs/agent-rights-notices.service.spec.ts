import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { reportFactsKind } from "@nivo-lite/agent-sdk/team-chat"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeEffectExecutor } from "@modules/domain/graph-nodes"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentGraphsLogEvent } from "./agent-graphs.log-events"
import { AgentRightsNoticesService } from "./agent-rights-notices.service"
import { AGENT_GRAPHS_MESSAGES } from "./messages/agent-graphs.messages"

const PUBLISH = { workspaceId: "ws-1", agentId: "agent-1", workflowId: "wf-p", graphVersionId: "graph-v2" }

const noticesOf = async (post: NodeEffectExecutor | undefined) => {
    const nodes = mock<GraphNodeRegistryService>({ optionalExecutorOf: jest.fn().mockReturnValue(post) })
    const logger = mock<Logger>()
    const catalog = mock<MessageCatalog>({ get: jest.fn((key: string) => `words of ${key}`) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentRightsNoticesService,
            { provide: GraphNodeRegistryService, useValue: nodes },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { notices: moduleRef.get(AgentRightsNoticesService), nodes, logger }
}

describe("AgentRightsNoticesService.publishUnfinished", () => {
    it("tells the founder once per published version, as a typed report of the engine's own words with the ids as technical facts", async () => {
        const post = mock<NodeEffectExecutor>()
        const { notices, nodes } = await noticesOf(post)

        await notices.publishUnfinished(PUBLISH)
        await notices.publishUnfinished(PUBLISH)

        const key = "rights-stamp:agent-1:graph-v2"
        expect(nodes.optionalExecutorOf).toHaveBeenCalledWith(TOOL.teamMessagePost)
        expect(post.execute).toHaveBeenCalledTimes(2)
        expect(post.execute.mock.calls.map((call) => call[2])).toEqual([
            { key, dedupeKey: key },
            { key, dedupeKey: key },
        ])
        expect(post.execute.mock.calls[0]?.[0]).toMatchObject({
            workspaceId: "ws-1",
            agentId: "agent-1",
            conversationId: null,
            origin: "system",
        })
        expect(post.execute.mock.calls[0]?.[1]).toEqual({
            kind: reportFactsKind.id,
            title: "words of agentGraphs.publishUnfinished.title",
            text: "words of agentGraphs.publishUnfinished.sentence",
            facts: [
                { name: "workflow", value: "wf-p", technical: true },
                { name: "version", value: "graph-v2", technical: true },
            ],
            audience: "founder",
        })
    })

    it("has its words in both languages of the catalogue", () => {
        const keys = ["agentGraphs.publishUnfinished.title", "agentGraphs.publishUnfinished.sentence"]

        expect(
            Object.values(AGENT_GRAPHS_MESSAGES).map((words) => keys.every((key) => String(Reflect.get(words, key)) !== "")),
        ).toEqual([true, true])
        expect(
            Object.values(AGENT_GRAPHS_MESSAGES).map((words) => keys.map((key) => typeof Reflect.get(words, key))),
        ).toEqual([
            ["string", "string"],
            ["string", "string"],
        ])
    })

    it("never throws: an app with no team chat, or a chat that refuses the report, is logged", async () => {
        const none = await noticesOf(undefined)

        await expect(none.notices.publishUnfinished(PUBLISH)).resolves.toBeUndefined()
        expect(none.logger.warn).toHaveBeenCalledWith(AgentGraphsLogEvent.RightsNoticeSkipped, {
            agentId: "agent-1",
            workflowId: "wf-p",
        })

        const cause = new Error("chat")
        const post = mock<NodeEffectExecutor>()
        post.execute.mockRejectedValue(cause)
        const refused = await noticesOf(post)

        await expect(refused.notices.publishUnfinished(PUBLISH)).resolves.toBeUndefined()
        expect(refused.logger.error).toHaveBeenCalledWith(AgentGraphsLogEvent.RightsNoticeSkipped, cause, {
            agentId: "agent-1",
            workflowId: "wf-p",
        })
    })
})
