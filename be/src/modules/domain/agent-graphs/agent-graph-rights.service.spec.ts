import { FLOW_BEFORE_NODE_RIGHTS, RIGHTS_FLOW, rightsWorldOf } from "@tests/fixtures/builders/agent-rights.builder"
import { ownerEdited } from "@tests/fixtures/builders/agent-workflows.builder"
import { snapshotHashOf } from "./policies/workflow-view.policy"

describe("AgentGraphRightsService.decide", () => {
    it("judges nothing and reads nothing for a graph none of whose nodes states an account", async () => {
        const { rights, access, consents, engine } = await rightsWorldOf()
        const question = { workspaceId: "ws-1", agentId: "agent-1", workflowId: "wf-p", byTemplate: false }
        const consent = { memberId: "dinh", role: "manager", agreed: [] }

        const settled = await rights.decide({
            ...question,
            before: FLOW_BEFORE_NODE_RIGHTS,
            after: ownerEdited(FLOW_BEFORE_NODE_RIGHTS),
            consent,
        })

        expect([settled.graphHash, settled.grants]).toEqual([snapshotHashOf(ownerEdited(FLOW_BEFORE_NODE_RIGHTS)), []])
        expect(access.listOfAgent).not.toHaveBeenCalled()
        expect(consents.listOfWorkflow).not.toHaveBeenCalled()
        expect(engine.scoped).not.toHaveBeenCalled()
    })
})

describe("AgentGraphRightsService.decide on a graph whose nodes list accounts: there is no gate", () => {
    it("settles nothing to agree on a person's road as on a road no person walks, and reads no grant row", async () => {
        const { rights, consents, access, notices } = await rightsWorldOf()
        const question = {
            workspaceId: "ws-1",
            agentId: "agent-1",
            workflowId: "wf-p",
            before: null,
            after: RIGHTS_FLOW,
            byTemplate: false,
        }

        const byManager = await rights.decide({ ...question, consent: { memberId: "dinh", role: "manager", agreed: [] } })
        const byNoOne = await rights.decide({ ...question, byTemplate: true })

        for (const settled of [byManager, byNoOne]) {
            expect([settled.graphHash, settled.grants, settled.pending]).toEqual([snapshotHashOf(RIGHTS_FLOW), [], []])
        }
        await expect(rights.judge(question)).resolves.toMatchObject({ refused: [] })
        expect(consents.listOfWorkflow).not.toHaveBeenCalled()
        expect(access.listOfAgent).not.toHaveBeenCalled()
        expect(notices.publishUnfinished).not.toHaveBeenCalled()
    })
})
