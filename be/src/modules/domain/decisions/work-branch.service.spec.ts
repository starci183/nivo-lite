import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WORK_BRANCH_DECIDER } from "@modules/domain/authority-rules"
import type { OptionalBranchJudgement, WorkBranchDecider } from "@modules/domain/authority-rules"
import { itemOf, quote } from "@tests/fixtures/builders/work-engine.builder"
import type { GateVerdict, Proposal } from "./decisions.contracts"
import { WorkBranchService } from "./work-branch.service"

const GATE: GateVerdict = { verdict: "auto", reason: "routine", reasons: ["routine"], missing: [] }
const BRANCH: GateVerdict = { verdict: "ask", reason: "over_authority", reasons: ["over_authority"], missing: [] }
const WIDENED: Proposal = { ...quote, amount_vnd: 7_200_000 }
const ORIGIN = { turnId: "turn-1", wakeId: "wake-1" }

const consultOf = (origin: typeof ORIGIN | null = null) => ({
    workspaceId: "ws-1",
    item: itemOf(),
    proposal: quote,
    origin,
    gate: jest.fn().mockResolvedValue(GATE),
})

const build = async (judgement?: OptionalBranchJudgement) => {
    const decider = mock<WorkBranchDecider>({ decide: jest.fn().mockResolvedValue(judgement) })
    const moduleRef = await Test.createTestingModule({
        providers: [WorkBranchService, { provide: WORK_BRANCH_DECIDER, useValue: decider }],
    }).compile()
    return { service: moduleRef.get(WorkBranchService), decider }
}

describe("WorkBranchService.consult", () => {
    it("answers the verdict and the proposal of the branch, and keeps the decision that asked", async () => {
        const { service, decider } = await build({ proposal: WIDENED, verdict: BRANCH, decisionId: "decision-1" })
        const consult = consultOf(ORIGIN)

        await expect(service.consult(consult)).resolves.toEqual({
            proposal: WIDENED,
            verdict: BRANCH,
            carried: { proposal: WIDENED, branchDecisionId: "decision-1" },
        })

        expect(decider.decide).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            item: consult.item,
            proposal: quote,
            gate: consult.gate,
            ...ORIGIN,
        })
        expect(consult.gate).not.toHaveBeenCalled()
    })

    it("lets the gate judge the proposal alone when the graph has no say", async () => {
        const { service, decider } = await build(null)
        const consult = consultOf()

        await expect(service.consult(consult)).resolves.toEqual({ proposal: quote, verdict: GATE, carried: {} })

        expect(decider.decide).toHaveBeenCalledWith(expect.objectContaining({ turnId: null, wakeId: null }))
        expect(consult.gate).toHaveBeenCalledWith(quote)
    })
})

describe("WorkBranchService.consult with no graph bound", () => {
    it("lets the gate judge the proposal alone", async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [WorkBranchService, { provide: WORK_BRANCH_DECIDER, useValue: null }],
        }).compile()
        const consult = consultOf()

        await expect(moduleRef.get(WorkBranchService).consult(consult)).resolves.toEqual({
            proposal: quote,
            verdict: GATE,
            carried: {},
        })
    })
})
