import { Test } from "@nestjs/testing"
import { ACCOUNTING_MODULE } from "../accounting.contracts"
import { branchWritesOf, graphGapLine } from "./setup-branch.policy"

/** The members of the subject under test. */
interface Subject {
    readonly branchWritesOf: typeof branchWritesOf
    readonly graphGapLine: typeof graphGapLine
}

const SUBJECT = Symbol("setup-branch.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { branchWritesOf, graphGapLine } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const MODULE = ACCOUNTING_MODULE

const RAW = {
    kind: "branch",
    gate: "g1",
    action: "issue_invoice",
    boundary: 5_000_000,
    approver: "Mr Nam",
    belongs: "higher",
    quote: "ask Nam",
}

describe("setup-branch.policy branchWritesOf", () => {
    it("keeps a branch of an action with an amount limit, with the person as said and no seat yet", async () => {
        const subject = await build()

        expect(subject.branchWritesOf(MODULE, [RAW])).toEqual([
            {
                gateKey: "g1",
                kind: "branch",
                payload: {
                    action: "issue_invoice",
                    boundaryVnd: 5_000_000,
                    belongsTo: "higher",
                    approverName: "Mr Nam",
                    approverMemberId: null,
                    quote: "ask Nam",
                },
            },
        ])
    })

    it("leaves the band open when the owner did not say it, and drops what the module does not govern or what lacks an amount or a person", async () => {
        const subject = await build()

        const kept = subject.branchWritesOf(MODULE, [
            { ...RAW, belongs: "both" },
            { ...RAW, action: "review_einvoice" },
            { ...RAW, action: "unknown" },
            { ...RAW, boundary: 0 },
            { ...RAW, boundary: "soon" },
            { ...RAW, approver: "  " },
            { ...RAW, kind: "rule" },
            "text",
        ])

        expect(kept.map((write) => [write.payload.action, write.payload.belongsTo])).toEqual([["issue_invoice", null]])
    })

    it("keeps one branch for an action, the last said, and reads nothing from what is not a list", async () => {
        const subject = await build()

        const kept = subject.branchWritesOf(MODULE, [RAW, { ...RAW, boundary: 9_000_000 }])

        expect(kept.map((write) => write.payload.boundaryVnd)).toEqual([9_000_000])
        expect(subject.branchWritesOf(MODULE, undefined)).toEqual([])
    })
})

describe("setup-branch.policy graphGapLine", () => {
    it("asks about the one vague place the code names, and says how to answer", async () => {
        const subject = await build()

        const line = subject.graphGapLine("boundary")

        expect(line).toContain("which band the exact amount belongs to")
        expect(line).toContain('"kind": "branch"')
    })

    it("says nothing when the flow is whole or the code is not one it knows", async () => {
        const subject = await build()

        expect(subject.graphGapLine(null)).toBe("")
        expect(subject.graphGapLine("somewhere_else")).toBe("")
    })
})
