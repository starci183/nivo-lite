import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { AgentGraphsLogEvent } from "./agent-graphs.log-events"
import { AgentGraphsService } from "./agent-graphs.service"
import { AgentNodeRequestsService } from "./agent-node-requests.service"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import { workflowConflict } from "./policies/workflow-view.policy"

// The ONE reader of a node's request (nivo-frame `rights`): the pinned version's node answers its declared `mode` and its accounts
// (the providers it lists, in order). A node that states no mode has NO request: the engine has no default mode.

const FLOW = {
    schema: "nivo/agent-graph@1",
    moduleKey: "accounting",
    trigger: { kind: "tag", sources: ["channel"] },
    grant: { tools: [], effects: [] },
    nodes: [
        { key: "unstated", kind: "execute", step: "accounting.match-payment", accounts: [] },
        { key: "quiet", kind: "execute", step: "accounting.match-payment", mode: "ask", records: { "video.project": "write" } },
        {
            key: "ledger",
            kind: "execute",
            step: "accounting.post-payment",
            mode: "auto",
            accounts: [
                { kind: "books", provider: "google", connectionId: null },
                { kind: "payment", provider: "sepay", connectionId: null },
            ],
        },
    ],
}

const STEP = { nodeKey: "ledger", versionId: "v-7", workflowId: "wf-1" }

const build = async () => {
    const graphs = mock<AgentGraphsService>({
        versionAt: jest.fn().mockResolvedValue({ version: 7, document: { nodes: [], flow: FLOW } }),
    })
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentNodeRequestsService,
            { provide: AgentGraphsService, useValue: graphs },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { requests: moduleRef.get(AgentNodeRequestsService), graphs, logger }
}

describe("AgentNodeRequestsService", () => {
    it("answers the node's declared mode and its providers in the order it lists them", async () => {
        const { requests, graphs } = await build()

        await expect(requests.requestOf("ws-1", "agent-1", STEP)).resolves.toEqual({
            mode: "auto",
            accounts: [
                { kind: "books", provider: "google", connectionId: null },
                { kind: "payment", provider: "sepay", connectionId: null },
            ],
        })
        expect(graphs.versionAt).toHaveBeenCalledWith("ws-1", "agent-1", "v-7")
    })

    it("answers a node that lists no account with its mode and no account", async () => {
        const { requests } = await build()

        await expect(requests.requestOf("ws-1", "agent-1", { ...STEP, nodeKey: "quiet" })).resolves.toEqual({
            mode: "ask",
            accounts: [],
        })
    })

    it("an unstated mode is IMPOSSIBLE: a node that states none has no request (no default), and it is logged", async () => {
        const { requests, logger } = await build()

        await expect(requests.requestOf("ws-1", "agent-1", { ...STEP, nodeKey: "unstated" })).resolves.toBeNull()
        expect(logger.warn).toHaveBeenCalledWith(
            AgentGraphsLogEvent.NodeModeUnstated,
            expect.objectContaining({ agentId: "agent-1", versionId: "v-7", nodeKey: "unstated" }),
        )
    })

    it("answers null for a node the version does not hold and for a version that is not the agent's, which is logged", async () => {
        const { requests, graphs, logger } = await build()

        await expect(requests.requestOf("ws-1", "agent-1", { ...STEP, nodeKey: "gone" })).resolves.toBeNull()
        graphs.versionAt.mockRejectedValue(new AgentGraphsError({ code: AgentGraphsErrorCode.VersionNotFound }))
        await expect(requests.requestOf("ws-1", "agent-2", STEP)).resolves.toBeNull()

        expect(logger.warn).toHaveBeenCalledWith(
            AgentGraphsLogEvent.NodeRequestUnreadable,
            expect.objectContaining({
                agentId: "agent-2",
                versionId: "v-7",
                code: AgentGraphsErrorCode.VersionNotFound,
            }),
        )
    })

    it("lets a failure that is no refusal of the graph store through", async () => {
        const { requests, graphs } = await build()
        const lost = new TypeError("lost")
        graphs.versionAt.mockRejectedValue(lost)

        await expect(requests.requestOf("ws-1", "agent-1", STEP)).rejects.toBe(lost)
        expect(workflowConflict()).toBeInstanceOf(AgentGraphsError)
    })
})
