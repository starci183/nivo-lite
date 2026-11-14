import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { FactRecord } from "@modules/domain/brain-facts"
import { brainPolicyDetailOf, policyRowsOf } from "./brain-policies.policy"
import { DON_TU_500_000_D_VI, GIAO_HANG_NOI_THANH_VI, GIAO_HANG_VI, GIAO_HOA_TOC_SAU_18_00_VI, GIO_MO_CUA_VI, MOT_DON_VI, PHI_GIAO_HANG_VI, PHU_PHI_15_000_D_VI, QUY_DINH_TIEM_HOA_VI, TIEM_VI, V_20_000_D_MOT_DON_VI, V_30_000_D_MOT_DON_VI, V_35K_NHE_VI, V_35_000_D_MOT_DON_VI, V_50_000_D_VI, V_8_00_DEN_20_00_VI } from "@tests/fixtures/i18n/brain-b-spec.messages"

/** A partial-object matcher, typed `unknown` so it flows into any slot. */
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)
const SUBJECT = Symbol("brain-policies.policy")

/** The policy's own functions, provided through a testing module the way Nest builds a subject. */
const build = async (): Promise<typeof import("./brain-policies.policy")> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { brainPolicyDetailOf, policyRowsOf } }],
    }).compile()
    return moduleRef.get<typeof import("./brain-policies.policy")>(SUBJECT)
}

const NOW = Date.parse("2026-11-11T10:00:00.000Z")
const LATER = "2026-12-01T00:00:00.000Z"

const factOf = builder<FactRecord>({
    id: "fee",
    subjectType: "service",
    subjectKey: "giao-hang-noi-thanh",
    subjectLabel: GIAO_HANG_NOI_THANH_VI,
    attribute: "phi-giao-hang",
    attributeLabel: PHI_GIAO_HANG_VI,
    value: V_30_000_D_MOT_DON_VI,
    valueNumber: 30000,
    unit: null,
    scope: "internal",
    modules: [],
    installationId: null,
    status: "active",
    sourceKind: "document",
    trust: 75,
    validFrom: "2026-11-10T00:00:00.000Z",
    validTo: "2027-11-10T00:00:00.000Z",
    supersedesId: null,
    conflictWith: null,
    proposalKind: "set",
    evidence: [
        {
            kind: "document",
            ref: "doc-1",
            label: QUY_DINH_TIEM_HOA_VI,
            title: QUY_DINH_TIEM_HOA_VI,
            sourceId: "doc-1",
            at: "2026-11-10T00:00:00.000Z",
        },
    ],
    proposedBy: "NIVO",
    proposedAt: "2026-11-10T00:00:00.000Z",
    decidedBy: "Ada",
    decidedAt: "2026-11-10T00:00:00.000Z",
    decisionNote: null,
})

const fee = factOf({ version: 2 })
const oldFee = factOf({ id: "fee-v1", status: "superseded", value: V_20_000_D_MOT_DON_VI, version: 1 })
const hours = factOf({
    id: "hours",
    subjectType: "business",
    subjectKey: "tiem",
    subjectLabel: TIEM_VI,
    attribute: "gio-mo-cua",
    attributeLabel: GIO_MO_CUA_VI,
    value: V_8_00_DEN_20_00_VI,
    scope: "public",
    version: 1,
})
const { version: _hoursVersion, ...hoursWithoutVersion } = hours
const laterHours = factOf({
    ...hoursWithoutVersion,
    id: "hours-later",
    status: "scheduled",
    value: "7:00-21:00",
    validFrom: LATER,
})
const product = factOf({
    id: "rose",
    subjectType: "product",
    subjectKey: "hoa-hong",
    attribute: "gia",
    value: V_50_000_D_VI,
})
const chatProposal = factOf({
    id: "p-fee",
    status: "proposed",
    value: V_35_000_D_MOT_DON_VI,
    sourceKind: "staff",
    proposedBy: "sales",
    proposedAt: "2026-11-11T08:00:00.000Z",
    conflictWith: "fee",
    decidedBy: null,
    decidedAt: null,
    evidence: [
        {
            kind: "message",
            ref: "team-chat:m1",
            label: "Private chat with an agent",
            quote: V_35K_NHE_VI,
            at: "2026-11-11T08:00:00.000Z",
        },
    ],
})
const unsetProposal = factOf({
    id: "p-express",
    status: "proposed",
    subjectType: "policy",
    subjectKey: "giao-hang",
    subjectLabel: GIAO_HANG_VI,
    attribute: "giao-hoa-toc-sau-18-00",
    attributeLabel: GIAO_HOA_TOC_SAU_18_00_VI,
    value: PHU_PHI_15_000_D_VI,
    proposedBy: "sales",
    proposedAt: "2026-11-11T09:00:00.000Z",
    decidedBy: null,
    decidedAt: null,
})

describe("brain-policies.policy: policyRowsOf", () => {
    let subject: typeof import("./brain-policies.policy")

    beforeEach(async () => {
        subject = await build()
    })

    it("reads the value in force as a parameter with its source, version and audience, and claims the waiting proposals", () => {
        const [row] = subject.policyRowsOf([fee], [chatProposal], NOW)

        expect(row).toMatchObject({
            factId: "fee",
            type: "money",
            current: {
                factId: "fee",
                value: V_30_000_D_MOT_DON_VI,
                parameter: { type: "money", amountVnd: 30000, per: MOT_DON_VI },
                version: 2,
                source: { kind: "document", label: QUY_DINH_TIEM_HOA_VI, at: "2026-11-10T00:00:00.000Z", count: 1 },
                audience: { scope: "internal", customers: false, installationId: null },
            },
            scheduled: null,
            pendingCount: 1,
            pendingValues: [V_35_000_D_MOT_DON_VI],
        })
    })

    it("shows a value approved for later as `scheduled` beside the one in force", () => {
        const [row] = subject.policyRowsOf([hours, laterHours], [], NOW)

        expect(row?.current?.parameter).toEqual({ type: "time_range", from: "08:00", to: "20:00" })
        expect(row?.current?.audience.customers).toBe(true)
        expect(row?.scheduled).toMatchObject({ factId: "hours-later", validFrom: LATER, status: "scheduled" })
    })

    it("treats a scheduled value whose start has come as the one in force (FX5)", () => {
        const started = factOf({ ...laterHours, validFrom: "2026-11-11T00:00:00.000Z" })
        const ended = factOf({ ...hours, validTo: "2026-11-11T00:00:00.000Z" })

        const [row] = subject.policyRowsOf([ended, started], [], NOW)

        expect(row?.current?.factId).toBe("hours-later")
        expect(row?.scheduled).toBeNull()
    })

    it("shows a truth with only a waiting value as `not set` (current null) with its proposals", () => {
        const [row] = subject.policyRowsOf([], [unsetProposal], NOW)

        expect(row).toMatchObject({
            factId: "p-express",
            current: null,
            scheduled: null,
            pendingCount: 1,
            type: "text",
        })
    })

    it("keeps a value that does not parse as a text row, never a guess", () => {
        const [row] = subject.policyRowsOf([factOf({ id: "free", value: DON_TU_500_000_D_VI })], [], NOW)

        expect(row?.type).toBe("text")
        expect(row?.current?.parameter).toEqual({ type: "text", text: DON_TU_500_000_D_VI })
    })

    it("leaves a product out under the subject-type rule and keeps it under a rule that says it is a policy", () => {
        expect(subject.policyRowsOf([product], [], NOW)).toEqual([])
        expect(subject.policyRowsOf([product], [], NOW, () => true).map((row) => row.factId)).toEqual(["rose"])
    })
})

describe("brain-policies.policy: brainPolicyDetailOf", () => {
    let subject: typeof import("./brain-policies.policy")

    beforeEach(async () => {
        subject = await build()
    })

    it("answers the row, its proposals with the decide action, and the history newest version first", () => {
        const detail = subject.brainPolicyDetailOf(fee, [fee, oldFee], [chatProposal], true, NOW)

        expect(detail?.proposals).toEqual([
            expect.objectContaining({
                factId: "p-fee",
                value: V_35_000_D_MOT_DON_VI,
                proposedBy: "sales",
                useAction: "choose",
                source: objectLike({ kind: "chat", label: "Private chat with an agent" }),
            }),
        ])
        expect(detail?.history.map((value) => [value.factId, value.version])).toEqual([
            ["fee", 2],
            ["fee-v1", 1],
        ])
        expect(detail?.canEdit).toBe(true)
    })

    it("answers null for a fact that is not a policy under the rule given", () => {
        expect(subject.brainPolicyDetailOf(product, [product], [], true, NOW)).toBeNull()
        expect(subject.brainPolicyDetailOf(fee, [fee], [], true, NOW, () => false)).toBeNull()
    })
})
