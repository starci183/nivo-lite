import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { templateGraph } from "@tests/fixtures/builders/agent-workflows.builder"
import { AgentGraphsService } from "./agent-graphs.service"
import { AgentNodeRequestsService } from "./agent-node-requests.service"

/**
 * The request reader on a REAL template graph (nivo-frame `rights`): the adapter carries a template step's ONE mode on the `@1` node's
 * accounts (a step of NIVO's own tools only on the pseudo-account `nivo`), so the request of a pinned template step answers the step's
 * mode and its providers in order, `nivo` none of them. There is no money floor. (The reconcile graph this spec read left with the money,
 * wave 4: the consult graph stands for steps of NIVO's own tools and for steps that act through messaging providers, the payment graph of
 * the web books for the bank feeds.)
 */

const CONSULT = templateGraph("sales.consult")
const PAYMENT = templateGraph("webbooks.payment")

const build = async (flow = CONSULT) => {
    const graphs = mock<AgentGraphsService>({
        versionAt: jest.fn().mockResolvedValue({ version: 1, document: { nodes: [], flow } }),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentNodeRequestsService,
            { provide: AgentGraphsService, useValue: graphs },
            { provide: LOGGER, useValue: mock<Logger>() },
        ],
    }).compile()
    return moduleRef.get(AgentNodeRequestsService)
}

const stepOf = (nodeKey: string) => ({ nodeKey, versionId: "v-1", workflowId: "wf-consult" })

describe("AgentNodeRequestsService on a template graph: each step's ONE mode and its providers", () => {
    it("answers a step of NIVO's own tools by its mode and no provider", async () => {
        const requests = await build()

        await expect(requests.requestOf("ws-1", "agent-1", stepOf("keep-occasions"))).resolves.toEqual({ mode: "auto", accounts: [] })
        // The cancel is `auto` since the consult was recomposed (the graph cancels only an unpaid order): the same rule, its mode as declared.
        await expect(requests.requestOf("ws-1", "agent-1", stepOf("cancel-order"))).resolves.toEqual({ mode: "auto", accounts: [] })
    })

    it("answers a step that acts through providers by its mode and its providers in order, no connection", async () => {
        const requests = await build()

        const messaging = ["zalo_oa", "telegram", "meta"].map((provider) => ({ kind: "messaging", provider, connectionId: null }))
        await expect(requests.requestOf("ws-1", "agent-1", stepOf("consult"))).resolves.toEqual({ mode: "auto", accounts: messaging })
        await expect(requests.requestOf("ws-1", "agent-1", stepOf("tell-cancelled"))).resolves.toEqual({ mode: "auto", accounts: messaging })
        const bank = await build(PAYMENT)
        await expect(bank.requestOf("ws-1", "agent-1", stepOf("credit"))).resolves.toEqual({
            mode: "auto",
            accounts: [
                { kind: "payment", provider: "sepay", connectionId: null },
                { kind: "payment", provider: "casso", connectionId: null },
            ],
        })
    })

    it("asks for nothing on a step the pinned version does not hold", async () => {
        const requests = await build()

        await expect(requests.requestOf("ws-1", "agent-1", stepOf("no-such-step"))).resolves.toBeNull()
    })
})
