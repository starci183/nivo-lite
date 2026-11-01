import assert from "node:assert/strict"
import { Test } from "@nestjs/testing"
import { OWNER_EXAMPLE, graphOf } from "@tests/fixtures/builders/agent-graph.builder"
import { branchApprovalOf, branchApproverOf } from "./branch-approver.policy"

const SUBJECT = Symbol("branch-approver.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { branchApprovalOf, branchApproverOf } }],
    }).compile()
    return moduleRef.get<typeof import("./branch-approver.policy")>(SUBJECT)
}

const document = graphOf(OWNER_EXAMPLE)

describe("branchApproverOf", () => {
    it("finds the approver the branch of the action named", async () => {
        const subject = await build()

        expect(subject.branchApproverOf(document, "pay_supplier", "middle")).toMatchObject({
            policy: "any",
            timeoutMinutes: 240,
        })
    })

    it("answers null for a branch with no approver, a branch the graph lacks and an action it lacks", async () => {
        const subject = await build()

        expect(subject.branchApproverOf(document, "pay_supplier", "small")).toBeNull()
        expect(subject.branchApproverOf(document, "pay_supplier", "missing")).toBeNull()
        expect(subject.branchApproverOf(document, "missing", "middle")).toBeNull()
    })
})

describe("branchApprovalOf", () => {
    it("keeps the group, the policy and the wait of the approver and nothing else", async () => {
        const subject = await build()
        const approver = subject.branchApproverOf(document, "pay_supplier", "middle")

        assert(approver !== null)
        expect(subject.branchApprovalOf(approver)).toEqual({
            group: approver.group,
            policy: approver.policy,
            timeoutMinutes: approver.timeoutMinutes,
        })
    })
})
