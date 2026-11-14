import { builder } from "@starci/jest-preset"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { ProviderAttachmentView } from "@modules/domain/tool-grants"
import { templateGraph } from "@tests/fixtures/builders/agent-workflows.builder"
import { rightsWorkflowOf, rightsWorldOf } from "@tests/fixtures/builders/agent-rights.builder"
import type { WorkflowVersionRecord } from "./agent-workflows.contracts"
import type { RightsSettlement } from "./policies/node-rights-gate.policy"

/**
 * Install writes `position`: each row a settlement records takes the place of its account's provider in its node's list, read from
 * the graph of the version the rows are agreed for. Who agrees to what is untouched: the same rows, the same modes and origins.
 */

const SEND = TOOL.customerMessageSend

const ATTACHED: ReadonlyArray<ProviderAttachmentView> = [
    { agentId: "agent-1", connectionId: "c-zalo", provider: "zalo_oa" },
    { agentId: "agent-1", connectionId: "c-tele", provider: "telegram" },
]

/** The consult graph (`sales.consult`): its `consult` node lists Zalo, then Telegram, then Meta, each serving the node's customer send. */
const twoChannelGraph = (): GraphSpec => templateGraph("sales.consult")

const documentOf = (graph: GraphSpec): Readonly<Record<string, JsonValue>> => {
    const parsed: unknown = JSON.parse(JSON.stringify(graph))
    return parsed as Readonly<Record<string, JsonValue>>
}

const versionOf = builder<WorkflowVersionRecord>({
    id: "wfv-1",
    workspaceId: "ws-1",
    workflowId: "wf-p",
    agentId: "agent-1",
    number: 1,
    document: documentOf(twoChannelGraph()),
    documentHash: "hash",
    changeKind: "template",
    authorKind: "system",
    authorId: null,
    note: "",
    template: null,
    fromNumber: null,
    graphVersionId: null,
    publishedAt: new Date(0),
})

const settlementOf = builder<RightsSettlement>({
    graphHash: "hash",
    agentId: "agent-1",
    workflowId: "wf-p",
    grants: [
        { nodeKey: "consult", connectionId: "c-zalo", operation: SEND, mode: "auto", origin: "template" },
        { nodeKey: "consult", connectionId: "c-tele", operation: SEND, mode: "auto", origin: "template" },
    ],
    pending: [],
    agreedBy: null,
})

describe("AgentRightsRecordsService: the rows take their provider's place", () => {
    it("records the second provider of a node at position 1 and the first at 0 (absent), by the version they are agreed for", async () => {
        const { records, workflows, written } = await rightsWorldOf(ATTACHED)
        workflows.version.mockResolvedValue(versionOf())

        await records.record("ws-1", settlementOf(), "wfv-1")

        expect(written.map((row) => [row.connectionId, row.position ?? 0, row.mode, row.origin])).toEqual([
            ["c-zalo", 0, "auto", "template"],
            ["c-tele", 1, "auto", "template"],
        ])
        expect(workflows.version).toHaveBeenCalledWith(expect.anything(), "wfv-1")
    })

    it("places by the workflow's newest version when the rows name none and none runs yet, and on the caller's transaction in a run", async () => {
        const { records, workflows, written, engine, manager } = await rightsWorldOf(ATTACHED)
        workflows.workflow.mockResolvedValue(rightsWorkflowOf({ activeVersionId: null }))
        workflows.versionsOf.mockResolvedValue([versionOf()])

        await records.run("ws-1", settlementOf(), () => Promise.resolve(null), () => ({ workflowId: "wf-p", versionId: null }))

        expect(written.map((row) => row.position ?? 0)).toEqual([0, 1])
        expect(engine.within).toHaveBeenCalledWith(manager, "ws-1", expect.any(Function))
        expect(engine.scoped).not.toHaveBeenCalled()
    })

    it("keeps the rows as they are when the graph cannot be read, and says so in the log", async () => {
        const { records, workflows, written, logger } = await rightsWorldOf(ATTACHED)
        workflows.version.mockRejectedValue(new Error("down"))

        await records.record("ws-1", settlementOf(), "wfv-1")

        expect(written.map((row) => row.position)).toEqual([undefined, undefined])
        expect(logger.error).toHaveBeenCalledTimes(1)
    })
})
