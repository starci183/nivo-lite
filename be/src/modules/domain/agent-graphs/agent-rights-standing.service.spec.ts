import { mock } from "@starci/jest-preset"
import { RIGHTS_SEND, rightsWorkflowOf, rightsWorldOf } from "@tests/fixtures/builders/agent-rights.builder"
import { templateGraph } from "@tests/fixtures/builders/agent-workflows.builder"
import { jsonOf } from "./agent-graphs.mapper"
import type { WorkflowVersionRecord } from "./agent-workflows.contracts"

/**
 * What the running workflows stand on (nivo-frame `rights`): each running node, in its ONE declared mode, on the account each of its
 * providers binds among its agent's attachments. Nothing is granted or waits, so every entry stands (`granted: true`, asked = the mode).
 */
describe("AgentRightsStandingService: what running workflows stand on", () => {
    const rightsVersion = (): WorkflowVersionRecord =>
        mock<WorkflowVersionRecord>({ id: "wfv-1", number: 4, document: jsonOf(templateGraph("sales.consult")) })

    it("answers each node in its ONE mode on the agent's attached account of its provider, each entry standing", async () => {
        const { standing, workflows } = await rightsWorldOf()
        workflows.workflowsOfWorkspace.mockResolvedValue([rightsWorkflowOf()])
        workflows.version.mockResolvedValue(rightsVersion())

        const [first] = await standing.standingOf("ws-1")

        expect(first?.workflowName).toBe("Reconcile")
        // The consult step acts on the messaging provider (zalo_oa, the agent's attached account) in `auto`, as it declares; its other two
        // providers (telegram, meta) bind nothing the agent holds. (`sales.consult` stands where the reconcile graph stood, which left
        // with the money.)
        expect(first?.entries).toEqual(
            expect.arrayContaining([
                { nodeKey: "consult", connectionId: "c-zalo", operation: RIGHTS_SEND, mode: "auto", granted: true, asked: "auto" },
            ]),
        )
        expect(first?.entries.every((entry) => entry.granted && entry.asked === entry.mode)).toBe(true)
        // Only the agent's attachments are stood on: no entry names an account it is not attached to.
        expect([...new Set(first?.entries.map((entry) => entry.connectionId))].sort()).toEqual(["c-zalo"])
    })

    it("stands an agent with no attachment on nothing, and reads only that agent's attachments", async () => {
        const { standing, workflows } = await rightsWorldOf()
        workflows.workflowsOfWorkspace.mockResolvedValue([rightsWorkflowOf({ id: "wf-other", agentId: "agent-2" })])
        workflows.version.mockResolvedValue(rightsVersion())

        const [first] = await standing.standingOf("ws-1")

        expect(first?.agentId).toBe("agent-2")
        expect(first?.entries).toEqual([])
    })

    it("answers the RUNNING workflow version's number and id", async () => {
        const { standing, workflows } = await rightsWorldOf()
        workflows.workflowsOfWorkspace.mockResolvedValue([rightsWorkflowOf()])
        workflows.version.mockResolvedValue(rightsVersion())

        const [first] = await standing.standingOf("ws-1")

        expect(first?.versionNumber).toBe(4)
        expect(first?.versionId).toBe("wfv-1")
    })

    it("skips a workflow with no active version", async () => {
        const { standing, workflows } = await rightsWorldOf()
        workflows.workflowsOfWorkspace.mockResolvedValue([rightsWorkflowOf({ activeVersionId: null })])

        await expect(standing.standingOf("ws-1")).resolves.toEqual([])
    })
})
