import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WORK_BRANCH_DECIDER } from "@modules/domain/authority-rules"
import type {
    GraphAnswer,
    GraphCheck,
    OptionalBranchJudgement,
    WorkBranchDecider,
} from "@modules/domain/authority-rules"
import { itemOf, quote } from "@tests/fixtures/builders/work-engine.builder"
import type { GateVerdict, Proposal } from "./decisions.contracts"
import { WorkBranchService } from "./work-branch.service"

const GATE: GateVerdict = { verdict: "auto", reason: "routine", reasons: ["routine"], missing: [] }
const BRANCH: GateVerdict = { verdict: "ask", reason: "over_authority", reasons: ["over_authority"], missing: [] }
const WIDENED: Proposal = { ...quote, amount_vnd: 7_200_000 }
const DIVERT = { action: "hand_over_conversation", handoverTo: "support", asks: false }
const ORIGIN = { turnId: "turn-1", wakeId: "wake-1" }

const consultOf = (origin: typeof ORIGIN | null = null) => ({
    workspaceId: "ws-1",
    item: itemOf(),
    proposal: quote,
    origin,
    gate: jest.fn().mockResolvedValue(GATE),
})

const CHECK: GraphCheck = {
    workspaceId: "ws-1",
    installationId: "inst-1",
    action: "reply_customer",
    road: "reply",
    key: "reply:abc",
    subjectType: "conversation",
    subjectId: "conv-1",
    leadId: null,
    text: "Hello",
    evidence: null,
    attributes: {},
    turnId: null,
    wakeId: null,
    askOpensWork: false,
}

const build = async (judgement?: OptionalBranchJudgement, answer?: GraphAnswer) => {
    const decider = mock<WorkBranchDecider>({
        decide: jest.fn().mockResolvedValue(judgement),
        check: jest.fn().mockResolvedValue(answer),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [WorkBranchService, { provide: WORK_BRANCH_DECIDER, useValue: decider }],
    }).compile()
    return { service: moduleRef.get(WorkBranchService), decider }
}

describe("WorkBranchService.consult", () => {
    it("answers the verdict and the proposal of the branch, and keeps the decision that asked", async () => {
        const { service, decider } = await build({
            proposal: WIDENED,
            verdict: BRANCH,
            decisionId: "decision-1",
            stopped: false,
            divert: null,
        })
        const consult = consultOf(ORIGIN)

        await expect(service.consult(consult)).resolves.toEqual({
            proposal: WIDENED,
            verdict: BRANCH,
            carried: { proposal: WIDENED, branchDecisionId: "decision-1", stopped: false, divert: null },
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

    it("keeps no decision when the graph could not be read and asks, so nothing names an approver", async () => {
        const { service } = await build({
            proposal: quote,
            verdict: BRANCH,
            decisionId: null,
            stopped: false,
            divert: null,
        })

        await expect(service.consult(consultOf())).resolves.toEqual({
            proposal: quote,
            verdict: BRANCH,
            carried: { proposal: quote, stopped: false, divert: null },
        })
    })

    it("carries a stop and a divert of the branch for the engine to act on", async () => {
        const stopped = await build({ proposal: quote, verdict: BRANCH, decisionId: "d1", stopped: true, divert: null })
        const diverted = await build({
            proposal: quote,
            verdict: GATE,
            decisionId: "d2",
            stopped: false,
            divert: DIVERT,
        })

        await expect(stopped.service.consult(consultOf())).resolves.toMatchObject({
            carried: { stopped: true, divert: null },
        })
        await expect(diverted.service.consult(consultOf())).resolves.toMatchObject({
            carried: { branchDecisionId: "d2", stopped: false, divert: DIVERT },
        })
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

describe("WorkBranchService.check", () => {
    it("answers what the graph says about something that leaves with no work item", async () => {
        const answer: GraphAnswer = { outcome: "stop", unread: [], unjudged: null, divert: null }
        const { service, decider } = await build(null, answer)

        await expect(service.check(CHECK)).resolves.toBe(answer)
        expect(decider.check).toHaveBeenCalledWith(CHECK)
    })

    it("answers run when no graph is bound", async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [WorkBranchService, { provide: WORK_BRANCH_DECIDER, useValue: null }],
        }).compile()

        await expect(moduleRef.get(WorkBranchService).check(CHECK)).resolves.toEqual({
            outcome: "run",
            unread: [],
            unjudged: null,
            divert: null,
        })
    })
})
