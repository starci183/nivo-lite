import { Test } from "@nestjs/testing"
import { OWNER_EXAMPLE, amountIs, branchOf, graphOf, nodeOf } from "@tests/fixtures/builders/agent-graph.builder"
import type { GraphSource } from "../agent-graphs.contracts"
import { applyBranchSetup } from "./branch-setup.policy"

/** The members of the subject under test. */
interface Subject {
    readonly applyBranchSetup: typeof applyBranchSetup
}

const SUBJECT = Symbol("branch-setup.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { applyBranchSetup } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const SOURCE: GraphSource = { kind: "chat", messageId: "msg-1", quote: "above 8 million ask Mr Nam" }
const SETUP = { action: "pay_supplier", boundaryVnd: 8_000_000, belongsTo: "higher" as const, approverMemberId: "nam", source: SOURCE }
const BASE = graphOf(OWNER_EXAMPLE)

/** The branches of the first node that decides. */
const branchesOf = (document: ReturnType<typeof graphOf>) =>
    document.nodes.find((node) => node.decide !== undefined)?.decide?.branches ?? []

describe("branch-setup.policy", () => {
    it("moves the line to the amount said, gives the exact amount to the higher band, and asks the named person", async () => {
        const subject = await build()

        const branches = branchesOf(subject.applyBranchSetup(BASE, SETUP) ?? BASE)

        expect(branches.map((branch) => [branch.key, branch.when])).toEqual([
            ["small", amountIs("lt", 8_000_000)],
            ["middle", { all: [amountIs("gte", 8_000_000), amountIs("lt", 20_000_000)] }],
            ["else", "else"],
        ])
        expect(branches[1]?.approver?.group.members).toEqual(["nam"])
        expect(branches[0]?.sources).toContainEqual(SOURCE)
        expect(branches[1]?.sources).toContainEqual(SOURCE)
    })

    it("gives the exact amount to the lower band when the owner said so, keeping the policy and the wait", async () => {
        const subject = await build()

        const branches = branchesOf(subject.applyBranchSetup(BASE, { ...SETUP, belongsTo: "lower" }) ?? BASE)

        expect(branches[0]?.when).toEqual(amountIs("lte", 8_000_000))
        expect(branches[1]?.when).toEqual({ all: [amountIs("gt", 8_000_000), amountIs("lt", 20_000_000)] })
        expect(branches[1]?.approver?.policy).toBe(branchesOf(BASE)[1]?.approver?.policy)
        expect(branches[1]?.approver?.timeoutMinutes).toBe(branchesOf(BASE)[1]?.approver?.timeoutMinutes)
    })

    it("gives a branch that asked nobody yet a group of the named person and a day to answer", async () => {
        const subject = await build()
        const bare = graphOf([
            branchOf({ key: "small", when: amountIs("lt", 5_000_000), then: "auto", next: "act" }),
            branchOf({ key: "big", when: amountIs("gte", 5_000_000), then: "ask", next: "ask" }),
            branchOf({ key: "else", when: "else", then: "ask", next: "ask" }),
        ])

        const branches = branchesOf(subject.applyBranchSetup(bare, SETUP) ?? bare)

        expect(branches[1]?.approver).toMatchObject({
            group: { roles: [], rooms: [], members: ["nam"] },
            policy: "any",
            timeoutMinutes: 240,
            onTimeout: { kind: "unset" },
        })
    })

    it("answers nothing for an action with no pair of branches, and leaves the other nodes alone", async () => {
        const subject = await build()

        expect(subject.applyBranchSetup(BASE, { ...SETUP, action: "refund" })).toBeNull()
        expect(subject.applyBranchSetup({ nodes: [nodeOf({ key: "x" })], rights: [] }, SETUP)).toBeNull()
        expect(subject.applyBranchSetup(BASE, SETUP)?.nodes.filter((node) => node.decide === undefined)).toEqual(
            BASE.nodes.filter((node) => node.decide === undefined),
        )
    })
})
