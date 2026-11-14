import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { BrainFactsReadService } from "@modules/domain/brain-facts"
import type { FactRecord } from "@modules/domain/brain-facts"
import { KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import type { GapRecord } from "@modules/domain/knowledge-gaps"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { ADDRESS, DERIVE_NOW, FEE, HOURS, deriveFactOf, derivedOf } from "@tests/fixtures/builders/policy-derive.builder"
import { BrainPolicyDerivationsService } from "./brain-policy-derivations.service"
import type { PolicyDerivationState } from "./brain-policy-derivations.service"
import { BrainPolicyCandidatesService, NO_INSTALLATION } from "./brain-policy-candidates.service"
import { BrainPolicyReadService } from "./brain-policy-read.service"
import { BrainPolicyStoreService } from "./brain-policy-store.service"
import type { DerivedPolicy } from "./policy-derive.policy"
import { GIAO_HANG_VI, GIO_LAM_VIEC_VI, KHAC_VI, MUC_PHI_CHU_TIEM_CHINH_DUOC_VI, NGAY_GIAO_VI, NHOM_VI, PHI_GIAO_HANG_NOI_THANH_VI, PHI_SHIP_VI, QUY_DINH_2_VI, SHOP_CO_GIAO_CHU_NHAT_KHONG_VI, T_20_000_D_MOT_DON_VI, T_35_000_D_MOT_DON_VI } from "@tests/fixtures/i18n/brain-a-spec.messages"
import { DELIVERY_FEE_LABEL_VI, DELIVERY_GROUP_LABEL_VI, OPENING_HOURS_LABEL_VI, SHOP_LABEL_VI } from "@tests/fixtures/i18n/brain-spec.messages"

const WS = "ws-1"

const gap: GapRecord = {
    id: "g1",
    module: "chatbot",
    question: SHOP_CO_GIAO_CHU_NHAT_KHONG_VI,
    topic: GIAO_HANG_VI,
    attributeGuess: NGAY_GIAO_VI,
    count: 3,
    firstSeenAt: DERIVE_NOW,
    lastSeenAt: DERIVE_NOW,
    exampleConversationId: null,
    status: "open",
    reopenedCount: 0,
}

const stateOf = (fields: Partial<PolicyDerivationState> = {}): PolicyDerivationState => ({
    status: "idle",
    requestedAt: "2026-11-11T09:00:00.000Z",
    startedAt: "2026-11-11T09:00:01.000Z",
    derivedAt: "2026-11-11T09:00:05.000Z",
    attempts: 0,
    error: null,
    ...fields,
})

const STORED: ReadonlyArray<DerivedPolicy> = [
    derivedOf(FEE, { title: PHI_GIAO_HANG_NOI_THANH_VI, group: DELIVERY_GROUP_LABEL_VI, reason: MUC_PHI_CHU_TIEM_CHINH_DUOC_VI }),
    derivedOf(HOURS, { title: OPENING_HOURS_LABEL_VI, group: GIO_LAM_VIEC_VI }),
    derivedOf(ADDRESS, { kind: "not_policy" }),
]

/** What a spec lets the read service see: the facts in the workspace, the stored judgements, the derivation state and the caller's role. */
interface PolicyReadWorld {
    readonly facts: ReadonlyArray<FactRecord>
    readonly stored?: ReadonlyArray<DerivedPolicy>
    readonly state?: PolicyDerivationState | null
    readonly role?: WorkspaceMember["role"]
}

const build = async (options: PolicyReadWorld) => {
    const role = options.role ?? "owner"
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue({ userId: "u1", workspaceId: WS, role, staffId: null, displayName: "Ada", status: "active" })
    const reads = mock<BrainFactsReadService>()
    reads.list.mockImplementation((_ws, filter) =>
        Promise.resolve(
            options.facts.filter(
                (fact) =>
                    (filter.statuses === undefined || filter.statuses.includes(fact.status)) &&
                    (filter.subjectKey === undefined || fact.subjectKey === filter.subjectKey),
            ),
        ),
    )
    reads.get.mockImplementation((_ws, id) => Promise.resolve(options.facts.find((fact) => fact.id === id) ?? null))
    reads.byIds.mockImplementation((_ws, ids) => Promise.resolve(options.facts.filter((fact) => ids.includes(fact.id))))
    const gaps = mock<KnowledgeGapsService>()
    gaps.list.mockResolvedValue([gap])
    const stored = options.stored ?? STORED
    const store = mock<BrainPolicyStoreService>()
    store.all.mockResolvedValue([...stored])
    store.openPolicies.mockResolvedValue(stored.filter((row) => row.status === "open" && row.kind === "policy"))
    // The SQL of the candidates service, in memory: the facts of the judged truths, the proposals that name them, the unjudged count.
    const keyText = (subjectKey: string, attribute: string, installation: string | null): string =>
        `${subjectKey}|${attribute}|${installation ?? NO_INSTALLATION}`
    const candidates = mock<BrainPolicyCandidatesService>()
    candidates.factIdsOf.mockImplementation((_ws, keys, statuses) => {
        const wanted = new Set(keys.map((key) => keyText(key.subjectKey, key.attribute, key.installation)))
        return Promise.resolve(
            options.facts
                .filter((fact) => statuses.includes(fact.status) && wanted.has(keyText(fact.subjectKey, fact.attribute, fact.installationId)))
                .map((fact) => fact.id),
        )
    })
    candidates.proposalsAgainst.mockImplementation((_ws, ids) =>
        Promise.resolve(
            options.facts
                .filter((fact) => fact.status === "proposed" && fact.conflictWith !== null && ids.includes(fact.conflictWith))
                .map((fact) => fact.id),
        ),
    )
    candidates.unjudged.mockImplementation(() => {
        const judged = new Set(stored.map((row) => keyText(row.subjectKey, row.attribute, row.installationId)))
        const held = options.facts.filter(
            (fact) => (fact.status === "active" || fact.status === "scheduled") && fact.proposalKind === "set" && fact.subjectType !== "customer" && fact.subjectType !== "person",
        )
        return Promise.resolve(new Set(held.map((fact) => keyText(fact.subjectKey, fact.attribute, fact.installationId)).filter((key) => !judged.has(key))).size)
    })
    store.ofTruth.mockImplementation((_ws, truth) =>
        Promise.resolve(
            stored.find(
                (row) =>
                    row.subjectKey === truth.subjectKey &&
                    row.attribute === truth.attribute &&
                    row.installationId === truth.installationId,
            ) ?? null,
        ),
    )
    const derivations = mock<BrainPolicyDerivationsService>()
    derivations.state.mockResolvedValue(options.state === undefined ? stateOf() : options.state)
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrainPolicyReadService,
            { provide: CLOCK, useValue: new FakeClock(DERIVE_NOW) },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: BrainFactsReadService, useValue: reads },
            { provide: KnowledgeGapsService, useValue: gaps },
            { provide: BrainPolicyStoreService, useValue: store },
            { provide: BrainPolicyDerivationsService, useValue: derivations },
            { provide: BrainPolicyCandidatesService, useValue: candidates },
        ],
    }).compile()
    const service = moduleRef.get(BrainPolicyReadService)
    return { service, members, reads, gaps, store, derivations, candidates }
}

describe("BrainPolicyReadService: the tab", () => {
    it("shows the truths the AI derived as policies, under the derived group and title; identity data is not a row", async () => {
        const { service } = await build({ facts: [FEE, HOURS, ADDRESS] })

        const tab = await service.policies("u1", WS)

        expect(tab.groups.map((group) => [group.subjectKey, group.subjectLabel, group.rows.map((row) => row.factId)])).toEqual([
            ["giao-hang", DELIVERY_GROUP_LABEL_VI, ["fee"]],
            ["gio-lam-viec", GIO_LAM_VIEC_VI, ["hours"]],
        ])
        expect(tab.groups[0]?.rows[0]).toMatchObject({
            policyId: "p-fee",
            title: PHI_GIAO_HANG_NOI_THANH_VI,
            reason: MUC_PHI_CHU_TIEM_CHINH_DUOC_VI,
            attributeLabel: DELIVERY_FEE_LABEL_VI,
            type: "money",
        })
        expect(tab.derivation).toEqual({ state: "ready", pendingFacts: 0, derivedAt: "2026-11-11T09:00:05.000Z", error: null })
        expect(tab.canEdit).toBe(true)
        expect(tab.missing.map((one) => one.gapId)).toEqual(["g1"])
    })

    it("reads the value from the fact in force, never from the layer: an edit shows at once, before any pass re-binds", async () => {
        const next = deriveFactOf({ id: "fee-v2", value: T_35_000_D_MOT_DON_VI, version: 2, supersedesId: "fee" })
        const { service } = await build({ facts: [next, HOURS] })

        const tab = await service.policies("u1", WS)

        const row = tab.groups[0]?.rows[0]
        expect(row).toMatchObject({ factId: "fee-v2", policyId: "p-fee", title: PHI_GIAO_HANG_NOI_THANH_VI })
        expect(row?.current).toMatchObject({ factId: "fee-v2", value: T_35_000_D_MOT_DON_VI, version: 2 })
        expect(row?.current?.parameter).toMatchObject({ type: "money", amountVnd: 35000 })
        // The same kind of value of a judged truth is not a truth waiting to be judged.
        expect(tab.derivation.pendingFacts).toBe(0)
    })

    it("keeps the waiting proposals and the later value of a row, read from the facts", async () => {
        const proposal = deriveFactOf({ id: "p1", status: "proposed", value: T_35_000_D_MOT_DON_VI, conflictWith: "fee" })
        const later = deriveFactOf({
            id: "hours-later",
            subjectType: "business",
            subjectKey: "tiem",
            subjectLabel: SHOP_LABEL_VI,
            attribute: "gio-mo-cua",
            attributeLabel: OPENING_HOURS_LABEL_VI,
            value: "7:00-21:00",
            status: "scheduled",
            validFrom: "2026-12-01T00:00:00.000Z",
        })
        const { service } = await build({ facts: [FEE, HOURS, later, proposal] })

        const tab = await service.policies("u1", WS)

        expect(tab.pendingTotal).toBe(1)
        expect(tab.groups[0]?.rows[0]).toMatchObject({ pendingCount: 1, pendingValues: [T_35_000_D_MOT_DON_VI] })
        expect(tab.groups[1]?.rows[0]?.scheduled).toMatchObject({ factId: "hours-later", value: "7:00-21:00" })
    })
})

describe("BrainPolicyReadService: the derivation state, retired rows and the statement count", () => {
    it("a workspace with facts and no derived layer answers no rows and the state not_derived, with no model call or derive", async () => {
        const { service, derivations } = await build({ facts: [FEE, HOURS, ADDRESS], stored: [], state: null })

        const tab = await service.policies("u1", WS)

        expect(tab.groups).toEqual([])
        expect(tab.derivation).toEqual({ state: "not_derived", pendingFacts: 3, derivedAt: null, error: null })
        expect(derivations.request).not.toHaveBeenCalled()
        expect(derivations.requestFor).not.toHaveBeenCalled()
    })

    it.each([
        ["queued", "deriving"],
        ["running", "deriving"],
    ] as const)("a pass that is %s shows %s with the rows judged so far and the count still waiting", async (status, state) => {
        const express = deriveFactOf({ id: "express", attribute: "phi-ship", attributeLabel: PHI_SHIP_VI })
        const { service } = await build({ facts: [FEE, express], state: stateOf({ status }) })

        const tab = await service.policies("u1", WS)

        expect(tab.derivation).toMatchObject({ state, pendingFacts: 1 })
        expect(tab.groups.flatMap((group) => group.rows.map((row) => row.factId))).toEqual(["fee"])
    })

    it("a pass given up shows failed with its reason", async () => {
        const { service } = await build({ facts: [FEE], state: stateOf({ status: "failed", error: "credits" }) })

        const tab = await service.policies("u1", WS)

        expect(tab.derivation).toMatchObject({ state: "failed", error: "credits" })
    })

    it("a retired policy is not a row; a manager reads without the right to edit", async () => {
        const { service } = await build({
            facts: [FEE],
            stored: [derivedOf(FEE, { status: "retired" })],
            role: "manager",
        })

        const tab = await service.policies("u1", WS)

        expect(tab.groups).toEqual([])
        expect(tab.canEdit).toBe(false)
    })

    it("is seven statements whatever the number of rows (no N+1), read by the judgement table's keys, never a window of facts", async () => {
        const many = Array.from({ length: 150 }, (_, index) => deriveFactOf({ id: `f${String(index)}`, attribute: `a-${String(index)}` }))
        const { service, members, reads, gaps, store, derivations, candidates } = await build({
            facts: many,
            stored: many.map((fact) => derivedOf(fact, { group: `${NHOM_VI}${String(Number(fact.id.slice(1)) % 7)}` })),
        })

        const tab = await service.policies("u1", WS)

        expect(tab.groups.reduce((sum, group) => sum + group.rows.length, 0)).toBe(150)
        expect(members.require).toHaveBeenCalledTimes(1)
        expect(reads.list).not.toHaveBeenCalled()
        expect(store.openPolicies).toHaveBeenCalledTimes(1)
        expect(candidates.factIdsOf).toHaveBeenCalledTimes(1)
        expect(candidates.factIdsOf.mock.calls[0]?.[1]).toHaveLength(150)
        expect(candidates.factIdsOf.mock.calls[0]?.[2]).toEqual(["active", "scheduled", "proposed"])
        expect(candidates.proposalsAgainst).toHaveBeenCalledTimes(1)
        expect(reads.byIds).toHaveBeenCalledTimes(1)
        expect(candidates.unjudged).toHaveBeenCalledTimes(1)
        expect(reads.get).not.toHaveBeenCalled()
        expect(gaps.list).toHaveBeenCalledTimes(1)
        expect(store.all).not.toHaveBeenCalled()
        expect(store.ofTruth).not.toHaveBeenCalled()
        expect(derivations.state).toHaveBeenCalledTimes(1)
    })
})

describe("BrainPolicyReadService: the drawer", () => {
    it("answers the row with its derived title, its proposals and its history, in four reads", async () => {
        const old = deriveFactOf({ id: "fee-v0", status: "superseded", value: T_20_000_D_MOT_DON_VI, version: 0 })
        const proposal = deriveFactOf({ id: "p1", status: "proposed", value: T_35_000_D_MOT_DON_VI, conflictWith: "fee" })
        const { service, reads, store, derivations } = await build({ facts: [FEE, old, proposal, HOURS] })

        const detail = await service.detail("u1", WS, "fee")

        expect(detail?.row).toMatchObject({ factId: "fee", policyId: "p-fee", title: PHI_GIAO_HANG_NOI_THANH_VI })
        expect(detail?.proposals.map((one) => one.factId)).toEqual(["p1"])
        expect(detail?.history.map((one) => one.factId)).toEqual(["fee", "fee-v0"])
        expect(reads.get).toHaveBeenCalledTimes(1)
        expect(store.ofTruth).toHaveBeenCalledTimes(1)
        // The subject's facts (its proposals among them) and the proposals of other keys that name its values: never a window.
        expect(reads.list).toHaveBeenCalledTimes(1)
        expect(reads.list).toHaveBeenCalledWith(WS, { subjectKey: FEE.subjectKey, limit: 500 })
        expect(store.all).not.toHaveBeenCalled()
        expect(derivations.state).not.toHaveBeenCalled()
    })

    it("answers null for a fact the AI judged not a policy, for a truth not judged yet, and for an unknown fact", async () => {
        const stray = deriveFactOf({ id: "stray", attribute: "khac", attributeLabel: KHAC_VI })
        const { service } = await build({ facts: [FEE, ADDRESS, stray] })

        await expect(service.detail("u1", WS, "address")).resolves.toBeNull()
        await expect(service.detail("u1", WS, "stray")).resolves.toBeNull()
        await expect(service.detail("u1", WS, "nope")).resolves.toBeNull()
    })
})

describe("BrainPolicyReadService: D-BR-11", () => {
    it("a policy whose truth nothing holds any more (an undone bulk apply: only a waiting proposal left) is not a row", async () => {
        const waiting = deriveFactOf({ id: "fee-p", status: "proposed" })
        const { service } = await build({ facts: [waiting, HOURS] })

        const tab = await service.policies("u1", WS)

        expect(tab.groups.flatMap((group) => group.rows.map((row) => row.factId))).toEqual(["hours"])
    })
})

describe("BrainPolicyReadService at 5,000 facts (BRAIN-LIMITS item 3)", () => {
    it("lists every policy truth, also the ones older than the newest 2,000 facts, and counts the unjudged by SQL", async () => {
        // 5,000 truths in force, judged; 40 of the OLDEST are policies (the ones a newest-2,000 window lost), 10 truths not judged.
        const facts = Array.from({ length: 5010 }, (_, index) =>
            deriveFactOf({ id: `f${String(index)}`, attribute: `a-${String(index)}`, attributeLabel: `${QUY_DINH_2_VI}${String(index)}` }),
        )
        const stored = facts.slice(0, 5000).map((fact, index) =>
            index < 40 ? derivedOf(fact, { group: DELIVERY_GROUP_LABEL_VI }) : derivedOf(fact, { kind: "not_policy" }),
        )
        const { service, reads } = await build({ facts, stored })

        const tab = await service.policies("u1", WS)

        expect(tab.groups.reduce((sum, group) => sum + group.rows.length, 0)).toBe(40)
        expect(tab.derivation.pendingFacts).toBe(10)
        // Only the facts of the 40 policy truths are read, by id.
        expect(reads.byIds.mock.calls[0]?.[1]).toHaveLength(40)
    })
})

describe("BrainPolicyReadService: the wire shape of the Policies screen", () => {
    it("answers the tab in the flat wire shape: the same groups, count, right, questions and derive state", async () => {
        const { service } = await build({ facts: [] })
        const derivation = { state: "ready", pendingFacts: 0, derivedAt: null, error: null } as const
        const tab = { groups: [], pendingTotal: 0, canEdit: true, missing: [], derivation }
        const read = jest.spyOn(service, "policies").mockResolvedValue(tab)

        await expect(service.policiesWire("u1", WS)).resolves.toEqual(tab)

        expect(read).toHaveBeenCalledWith("u1", WS)
    })

    it("answers the drawer in the wire shape, and null for a fact that is no derived policy", async () => {
        const { service } = await build({ facts: [] })
        const read = jest.spyOn(service, "detail").mockResolvedValue(null)

        await expect(service.detailWire("u1", WS, "fact-1")).resolves.toBeNull()

        expect(read).toHaveBeenCalledWith("u1", WS, "fact-1")
    })
})
