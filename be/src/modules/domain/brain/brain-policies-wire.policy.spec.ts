import { Test } from "@nestjs/testing"
import { brainPoliciesWireOf, brainPolicyDetailWireOf } from "./brain-policies-wire.policy"
import type { PolicyProposalView, PolicyValueView } from "./brain-policies.contracts"
import type { DerivedBrainPolicies, DerivedBrainPolicyDetail, DerivedPolicyRow } from "./policy-derived-view.policy"
import type { PolicyValue } from "./policy-value.policy"

const SUBJECT = Symbol("brain-policies-wire.policy")

/** The policy's own functions, provided through a testing module the way Nest builds a subject. */
const build = async (): Promise<typeof import("./brain-policies-wire.policy")> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { brainPoliciesWireOf, brainPolicyDetailWireOf } }],
    }).compile()
    return moduleRef.get<typeof import("./brain-policies-wire.policy")>(SUBJECT)
}

const NULLS = { amountVnd: null, per: null, percent: null, minutes: null, from: null, to: null, yes: null, text: null }

const valueOf = (parameter: PolicyValue): PolicyValueView => ({
    factId: "fact-1",
    value: "30.000",
    unit: "VND",
    parameter,
    version: 2,
    status: "active",
    validFrom: null,
    validTo: null,
    source: { kind: "owner_edit", label: "Owner", at: null, count: 1 },
    audience: { scope: "internal", modules: ["sales"], customers: true, installationId: null },
})

const rowOf = (current: PolicyValueView | null): DerivedPolicyRow => ({
    factId: "fact-1",
    subjectKey: "delivery",
    attribute: "fee",
    subjectLabel: "Delivery",
    attributeLabel: "Fee",
    type: "money",
    current,
    scheduled: null,
    pendingCount: 1,
    pendingValues: ["40.000"],
    policyId: "pol-1",
    title: "Delivery fee",
    reason: "A price the shop states",
})

const POLICIES: DerivedBrainPolicies = {
    groups: [{ subjectKey: "delivery", subjectLabel: "Delivery", rows: [rowOf(valueOf({ type: "money", amountVnd: 30000, per: "order" }))] }],
    pendingTotal: 1,
    canEdit: true,
    missing: [
        { gapId: "g1", module: "sales", question: "Do you ship?", topic: null, attributeGuess: null, count: 2, lastSeenAt: "2026-11-13T00:00:00Z" },
    ],
    derivation: { state: "ready", pendingFacts: 0, derivedAt: null, error: null },
}

describe("brainPoliciesWireOf", () => {
    it("flattens a money parameter, keeping the row's fields and copying its lists", async () => {
        const { brainPoliciesWireOf: wireOf } = await build()

        const wire = wireOf(POLICIES)

        expect(wire.groups[0]?.rows[0]?.current?.parameter).toEqual({ ...NULLS, type: "money", amountVnd: 30000, per: "order" })
        expect(wire.groups[0]?.rows[0]).toMatchObject({ policyId: "pol-1", title: "Delivery fee", pendingValues: ["40.000"], scheduled: null })
        expect(wire.groups[0]?.rows[0]?.current?.audience.modules).toEqual(["sales"])
        expect(wire.groups[0]?.rows[0]?.pendingValues).not.toBe(POLICIES.groups[0]?.rows[0]?.pendingValues)
        expect(wire).toMatchObject({ pendingTotal: 1, canEdit: true, derivation: POLICIES.derivation, missing: POLICIES.missing })
    })

    it.each<[PolicyValue, Record<string, unknown>]>([
        [{ type: "percent", percent: 10 }, { type: "percent", percent: 10 }],
        [{ type: "duration", minutes: 45 }, { type: "duration", minutes: 45 }],
        [{ type: "time_range", from: "08:00", to: "17:00" }, { type: "time_range", from: "08:00", to: "17:00" }],
        [{ type: "boolean", yes: false }, { type: "boolean", yes: false }],
        [{ type: "text", text: "Free over 500k" }, { type: "text", text: "Free over 500k" }],
    ])("flattens %j to its own field and nulls the rest", async (parameter, expected) => {
        const { brainPoliciesWireOf: wireOf } = await build()
        const policies: DerivedBrainPolicies = { ...POLICIES, groups: [{ subjectKey: "s", subjectLabel: "S", rows: [rowOf(valueOf(parameter))] }] }

        expect(wireOf(policies).groups[0]?.rows[0]?.current?.parameter).toEqual({ ...NULLS, ...expected })
    })

    it("answers a row with no value in force as null", async () => {
        const { brainPoliciesWireOf: wireOf } = await build()
        const policies: DerivedBrainPolicies = { ...POLICIES, groups: [{ subjectKey: "s", subjectLabel: "S", rows: [rowOf(null)] }] }

        expect(wireOf(policies).groups[0]?.rows[0]?.current).toBeNull()
    })
})

describe("brainPolicyDetailWireOf", () => {
    it("answers null for no detail", async () => {
        const { brainPolicyDetailWireOf: wireOf } = await build()

        expect(wireOf(null)).toBeNull()
    })

    it("maps the row, the proposals with their own fields, and the history", async () => {
        const { brainPolicyDetailWireOf: wireOf } = await build()
        const proposal: PolicyProposalView = {
            ...valueOf({ type: "text", text: "x" }),
            kind: "set",
            proposedBy: "manager",
            proposedAt: "2026-11-13T00:00:00Z",
            flags: ["stale"],
            useAction: "choose",
        }
        const detail: DerivedBrainPolicyDetail = {
            row: rowOf(valueOf({ type: "boolean", yes: true })),
            proposals: [proposal],
            history: [valueOf({ type: "percent", percent: 5 })],
            canEdit: false,
        }

        const wire = wireOf(detail)

        expect(wire?.proposals[0]).toMatchObject({ kind: "set", proposedBy: "manager", flags: ["stale"], useAction: "choose" })
        expect(wire?.proposals[0]?.parameter).toEqual({ ...NULLS, type: "text", text: "x" })
        expect(wire?.history[0]?.parameter).toEqual({ ...NULLS, type: "percent", percent: 5 })
        expect(wire?.canEdit).toBe(false)
    })
})
