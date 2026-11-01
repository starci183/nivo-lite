import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { AgentTurnBriefService } from "./agent-turn-brief.service"
import { AGENT_GRAPH_BRIEF } from "./agent-turns.decorators"
import type { GraphIntent } from "./agent-turns.contracts"
import type { AgentGraphBrief } from "./agent-turns.port"

const catalog = mock<MessageCatalog>({ get: (key: string) => `[${key}]` })

const buildWithoutGraph = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentTurnBriefService,
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: AGENT_GRAPH_BRIEF, useValue: null },
        ],
    }).compile()
    return moduleRef.get(AgentTurnBriefService)
}

const buildWithGraph = async (intents: ReadonlyArray<GraphIntent>) => {
    const graph = mock<AgentGraphBrief>({ intentsOf: jest.fn(() => Promise.resolve(intents)) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentTurnBriefService,
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: AGENT_GRAPH_BRIEF, useValue: graph },
        ],
    }).compile()
    return { service: moduleRef.get(AgentTurnBriefService), graph }
}

describe("AgentTurnBriefService.intentsBlock", () => {
    it("is empty while no graph is bound, so the turn runs exactly as it did before there was a graph", async () => {
        const service = await buildWithoutGraph()

        await expect(service.intentsBlock("ws-1", "agent-1", "vi")).resolves.toBe("")
    })

    it("lists the intents the graph allows under their title, and only the intents", async () => {
        const { service, graph } = await buildWithGraph([
            { action: "send_invoice", label: "Send an invoice" },
            { action: "pay_supplier", label: "Pay a supplier" },
        ])

        await expect(service.intentsBlock("ws-1", "agent-1", "en")).resolves.toBe(
            "[agentTurns.intentsTitle]\n- send_invoice: Send an invoice\n- pay_supplier: Pay a supplier",
        )
        expect(graph.intentsOf).toHaveBeenCalledWith("ws-1", "agent-1")
    })

    it("is empty for an agent whose graph allows nothing", async () => {
        const { service } = await buildWithGraph([])

        await expect(service.intentsBlock("ws-1", "agent-1", "vi")).resolves.toBe("")
    })
})
