import { Test } from "@nestjs/testing"
import { basisOf, deriveBatchesOf, derivePlanOf, derivePrompt, groupsInUse, heldByTruth, judgementsOf, truthKeyOf } from "./policy-derive.policy"
import { ADDRESS, DERIVE_NOW, FEE, HOURS, deriveFactOf, derivedOf } from "@tests/fixtures/builders/policy-derive.builder"
import { DERIVE_BATCH, DERIVE_MAX_CALLS, DERIVE_SYSTEM } from "./policy-derive.policy"
import { CHU_TIEM_CHINH_DUOC_MUC_PHI_VI, CU_VI, GIO_LAM_VIEC_VI, GROUPS_IN_USE_GIAO_HANG_GIO_VI, MIEN_PHI_CHO_KHACH_QUEN_VI, PHI_GIAO_HANG_NOI_THANH_2_VI, PHI_GIAO_HANG_NOI_THANH_VI, PHI_SHIP_NOI_THANH_VI, PHI_SHIP_VI, THONG_TIN_LIEN_HE_VI, T_0_SERVICE_GIAO_HANG_NOI_THANH_VI, T_35_000_D_MOT_DON_VI, WAS_POLICY_PHI_GIAO_HANG_IN_VI } from "@tests/fixtures/i18n/brain-a-spec.messages"
import { DELIVERY_FEE_LABEL_VI, DELIVERY_GROUP_LABEL_VI } from "@tests/fixtures/i18n/brain-spec.messages"

const SUBJECT = Symbol("policy-derive.policy")
type Subject = typeof import("./policy-derive.policy")

const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { basisOf, deriveBatchesOf, derivePlanOf, derivePrompt, groupsInUse, heldByTruth, judgementsOf, truthKeyOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const AT = Date.parse(DERIVE_NOW)

describe("policy-derive.policy: heldByTruth", () => {
    let subject: Subject

    beforeAll(async () => {
        subject = await build()
    })

    it("keeps the value in force of each truth, the newest version first, and leaves out customer and person facts", () => {
        const old = deriveFactOf({ id: "fee-old", version: 1 })
        const fee = deriveFactOf({ id: "fee", version: 2 })
        const customer = deriveFactOf({ id: "c", subjectType: "customer", subjectKey: "chi-lan", attribute: "so-thich" })
        const person = deriveFactOf({ id: "p", subjectType: "person", subjectKey: "anh-ba", attribute: "sdt" })
        const waiting = deriveFactOf({ id: "w", status: "proposed", attribute: "khac" })

        const held = subject.heldByTruth([old, fee, customer, person, waiting, HOURS], AT)

        expect([...held.values()].map((fact) => fact.id).toSorted()).toEqual(["fee", "hours"])
    })

    it("binds a truth with nothing in force to its scheduled value, and prefers the value in force over a later one", () => {
        const later = deriveFactOf({ id: "fee-later", status: "scheduled", validFrom: "2026-12-01T00:00:00.000Z" })
        const onlyLater = deriveFactOf({ id: "ship-later", attribute: "phi-hoa-toc", status: "scheduled", validFrom: "2026-12-01T00:00:00.000Z" })

        const held = subject.heldByTruth([later, FEE, onlyLater], AT)

        expect(held.get(subject.truthKeyOf(FEE))?.id).toBe("fee")
        expect(held.get(subject.truthKeyOf(onlyLater))?.id).toBe("ship-later")
    })
})

describe("policy-derive.policy: basisOf", () => {
    let subject: Subject

    beforeAll(async () => {
        subject = await build()
    })

    it("does not change with the value, and changes with a label or the kind of value", () => {
        expect(subject.basisOf(deriveFactOf({ id: "a", value: T_35_000_D_MOT_DON_VI }))).toBe(subject.basisOf(FEE))
        expect(subject.basisOf(deriveFactOf({ id: "a", attributeLabel: PHI_SHIP_NOI_THANH_VI }))).not.toBe(subject.basisOf(FEE))
        expect(subject.basisOf(deriveFactOf({ id: "a", value: MIEN_PHI_CHO_KHACH_QUEN_VI }))).not.toBe(subject.basisOf(FEE))
    })
})

describe("policy-derive.policy: derivePlanOf", () => {
    let subject: Subject

    beforeAll(async () => {
        subject = await build()
    })

    const held = (...facts: Parameters<typeof heldByTruth>[0]) => subject.heldByTruth(facts, AT)

    it("asks the model for every truth with no judgement (add)", () => {
        const plan = subject.derivePlanOf(held(FEE, ADDRESS), [])

        expect(plan.ask.map((one) => [one.fact.id, one.known])).toEqual([
            ["fee", null],
            ["address", null],
        ])
        expect(plan.rebind).toEqual([])
        expect(plan.retire).toEqual([])
    })

    it("re-binds a judged truth to its next version without asking when only the value changed", () => {
        const next = deriveFactOf({ id: "fee-v2", value: T_35_000_D_MOT_DON_VI, version: 2 })

        const plan = subject.derivePlanOf(held(next), [derivedOf(FEE)])

        expect(plan.ask).toEqual([])
        expect(plan.rebind).toEqual([{ id: "p-fee", factId: "fee-v2", factVersion: 2, valueType: "money" }])
    })

    it("asks again, with the judgement so far, when a label or the kind of value changed (amend)", () => {
        const relabelled = deriveFactOf({ id: "fee-v2", attributeLabel: PHI_SHIP_VI, version: 2 })
        const known = derivedOf(FEE)

        const plan = subject.derivePlanOf(held(relabelled), [known])

        expect(plan.ask).toEqual([{ fact: relabelled, known }])
        expect(plan.rebind).toEqual([])
    })

    it("retires the judgement of a truth nothing holds, and brings it back without asking when the truth is held again", () => {
        const known = derivedOf(FEE)
        expect(subject.derivePlanOf(held(), [known, derivedOf(ADDRESS, { kind: "not_policy" })]).retire).toEqual(["p-fee", "p-address"])

        const back = deriveFactOf({ id: "fee-v3", version: 3 })
        const plan = subject.derivePlanOf(held(back), [{ ...known, status: "retired" }])

        expect(plan.ask).toEqual([])
        expect(plan.retire).toEqual([])
        expect(plan.rebind).toEqual([{ id: "p-fee", factId: "fee-v3", factVersion: 3, valueType: "money" }])
    })

    it("plans nothing over its own result (idempotent)", () => {
        const stored = [derivedOf(FEE), derivedOf(HOURS, { group: GIO_LAM_VIEC_VI }), derivedOf(ADDRESS, { kind: "not_policy" })]

        expect(subject.derivePlanOf(held(FEE, HOURS, ADDRESS), stored)).toEqual({ ask: [], rebind: [], retire: [] })
    })

    it("keeps a truth of one agent instance apart from the shop-wide one", () => {
        const own = deriveFactOf({ id: "fee-sales", installationId: "inst-1" })

        const plan = subject.derivePlanOf(held(FEE, own), [derivedOf(FEE)])

        expect(plan.ask.map((one) => one.fact.id)).toEqual(["fee-sales"])
    })
})

describe("policy-derive.policy: deriveBatchesOf", () => {
    let subject: Subject

    beforeAll(async () => {
        subject = await build()
    })

    it("bounds a pass to four calls of thirty facts", () => {
        const ask = Array.from({ length: 200 }, (_, index) => ({
            fact: deriveFactOf({ id: `f${String(index).padStart(3, "0")}`, attribute: `a-${String(index).padStart(3, "0")}` }),
            known: null,
        }))

        const batches = subject.deriveBatchesOf(ask)

        expect(batches).toHaveLength(DERIVE_MAX_CALLS)
        expect(batches.every((batch) => batch.length === DERIVE_BATCH)).toBe(true)
    })

    it("puts the new truths before the ones compared again", () => {
        const batches = subject.deriveBatchesOf([
            { fact: FEE, known: derivedOf(FEE) },
            { fact: HOURS, known: null },
        ])

        expect(batches[0]?.map((one) => one.fact.id)).toEqual(["hours", "fee"])
    })
})

describe("policy-derive.policy: derivePrompt", () => {
    let subject: Subject

    beforeAll(async () => {
        subject = await build()
    })

    it("lists the groups in use and one bounded line per fact, with the judgement so far of a fact compared again", () => {
        const long = deriveFactOf({ id: "long", value: "x".repeat(900) })

        const prompt = subject.derivePrompt(
            [
                { fact: FEE, known: null },
                { fact: long, known: derivedOf(FEE, { title: DELIVERY_FEE_LABEL_VI, group: DELIVERY_GROUP_LABEL_VI }) },
            ],
            [DELIVERY_GROUP_LABEL_VI, GIO_LAM_VIEC_VI],
        )

        expect(prompt).toContain(GROUPS_IN_USE_GIAO_HANG_GIO_VI)
        expect(prompt).toContain(T_0_SERVICE_GIAO_HANG_NOI_THANH_VI)
        expect(prompt).toContain(WAS_POLICY_PHI_GIAO_HANG_IN_VI)
        expect(prompt.length).toBeLessThan(800)
        expect(DERIVE_SYSTEM).toContain("Never invent")
    })

    it("says none when no group is in use", () => {
        expect(subject.derivePrompt([{ fact: FEE, known: null }], [])).toContain("Groups in use: none")
    })
})

describe("policy-derive.policy: groupsInUse", () => {
    let subject: Subject

    beforeAll(async () => {
        subject = await build()
    })

    it("lists the groups of the open policies, most used first", () => {
        const stored = [
            derivedOf(FEE, { group: DELIVERY_GROUP_LABEL_VI }),
            derivedOf(HOURS, { group: GIO_LAM_VIEC_VI }),
            derivedOf(deriveFactOf({ id: "x", attribute: "x" }), { group: DELIVERY_GROUP_LABEL_VI }),
            derivedOf(ADDRESS, { kind: "not_policy" }),
            derivedOf(deriveFactOf({ id: "y", attribute: "y" }), { group: CU_VI, status: "retired" }),
        ]

        expect(subject.groupsInUse(stored)).toEqual([DELIVERY_GROUP_LABEL_VI, GIO_LAM_VIEC_VI])
    })
})

describe("policy-derive.policy: judgementsOf", () => {
    let subject: Subject

    beforeAll(async () => {
        subject = await build()
    })

    it("reads one judgement per fact by its index", () => {
        const found = subject.judgementsOf(
            [
                { i: 0, policy: true, title: PHI_GIAO_HANG_NOI_THANH_2_VI, group: DELIVERY_GROUP_LABEL_VI, reason: CHU_TIEM_CHINH_DUOC_MUC_PHI_VI },
                { i: 1, policy: false, title: "x", group: "y", reason: THONG_TIN_LIEN_HE_VI },
            ],
            2,
        )

        expect(found.get(0)).toEqual({
            policy: true,
            title: PHI_GIAO_HANG_NOI_THANH_VI,
            group: DELIVERY_GROUP_LABEL_VI,
            reason: CHU_TIEM_CHINH_DUOC_MUC_PHI_VI,
        })
        expect(found.get(1)).toEqual({ policy: false, title: "", group: "", reason: THONG_TIN_LIEN_HE_VI })
    })

    it("drops an item out of range, without a verdict, repeated, or a policy with no title or group", () => {
        const found = subject.judgementsOf(
            {
                items: [
                    { i: 5, policy: true, title: "A", group: "B", reason: "" },
                    { i: 0, policy: "yes", title: "A", group: "B" },
                    { i: 1, policy: true, title: "", group: "B" },
                    { i: 2, policy: true, title: "A", group: "!!!" },
                    { i: 3, policy: true, title: "A", group: "B" },
                    { i: 3, policy: false },
                    "junk",
                ],
            },
            4,
        )

        expect([...found.keys()]).toEqual([3])
        expect(found.get(3)?.policy).toBe(true)
    })

    it("cuts a title, a group and a reason to their bounds and reads nothing from another shape", () => {
        const found = subject.judgementsOf([{ i: 0, policy: true, title: "t".repeat(500), group: "g".repeat(500), reason: "r".repeat(500) }], 1)

        expect(found.get(0)?.title).toHaveLength(80)
        expect(found.get(0)?.group).toHaveLength(40)
        expect(found.get(0)?.reason).toHaveLength(200)
        expect(subject.judgementsOf(null, 3).size).toBe(0)
        expect(subject.judgementsOf("text", 3).size).toBe(0)
    })
})
