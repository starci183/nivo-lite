import { WorkspaceTimeZoneService } from "@modules/domain/workspace-settings"
import * as facts from "@tests/fixtures/builders/brain-facts.builder"

import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"
import type { FakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder.builder"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { BrainFactsMaintenanceService } from "./brain-facts-maintenance.service"
import { BrainFactsReadService } from "./brain-facts-read.service"
import { BrainFactsService, MERGED_NOTE } from "./brain-facts.service"
import type { FactsChangedHook } from "./brain-facts.service"
import { InForceBoundService } from "./in-force-bound.service"
import { BrainFactRelationsService } from "./brain-fact-relations.service"
import { BrainFactsErrorCode } from "./errors/brain-facts.error"
import { SUPERSEDE } from "./fact-write.policy"
import { BrainFactEntity } from "./persistence/entities"

/**
 * The write doors of the truth graph against the cases the live walk of 2026-11-11 found (RESULTS-R1R2.md, workspace 487db21a):
 * D-BR-1 (audience), D-BR-4a (a second value of one truth), D-BR-7 (a line to the AI), D-BR-9 (a duplicate in other words), D-BR-12
 * (a value of another type), D-BR-16 (a date in the shop's clock), D-BR-18 (a time-boxed value over a standing one).
 */

const relationsDouble = mock<BrainFactRelationsService>()

const build = async (em: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrainFactsService,
            { provide: WorkspaceTimeZoneService, useValue: mock<WorkspaceTimeZoneService>({ timeZoneOf: () => Promise.resolve("Asia/Ho_Chi_Minh") }) },
            InForceBoundService,
            BrainFactsReadService,
            BrainFactsMaintenanceService,
            { provide: BrainFactRelationsService, useValue: relationsDouble },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(facts.AT) },
        ],
    }).compile()
    const service = moduleRef.get(BrainFactsService)
    const hook: FactsChangedHook & { readonly told: Array<ReadonlyArray<string>> } = {
        told: [],
        factsChanged(_workspaceId, ids) {
            this.told.push(ids)
            return Promise.resolve()
        },
    }
    service.whenChanged(hook)
    return { service, hook }
}

/** The condition of the active fact with this id in the spec workspace. */
const activeOf = (id: string) => ({ workspaceId: facts.WS, id, status: "active" })

/** A write that answered these rows. */
const answered = (...rows: ReadonlyArray<object>) => ({ execute: { raw: rows } })

const setOf = (fake: FakeQueryBuilder | undefined) => evaluatedValues(fake?.callsOf("set")[0]?.[0])
const valuesOf = (fake: FakeQueryBuilder | undefined) => evaluatedValues(fake?.callsOf("values")[0]?.[0])
const parametersOf = (fake: FakeQueryBuilder | undefined): Readonly<Record<string, unknown>> => {
    const first: unknown = fake?.callsOf("setParameters")[0]?.[0]
    return typeof first === "object" && first !== null ? Object.fromEntries(Object.entries(first)) : {}
}

/** The evidence a write stored, read back from its JSON parameter (an unreadable one reads as none). */
const evidenceOf = (fake: FakeQueryBuilder | undefined): unknown => {
    try {
        return JSON.parse(String(parametersOf(fake).evidence))
    } catch (cause) {
        return { unreadable: String(cause) }
    }
}

/** A public document's evidence (P01 "Bang phi"). */
const P01 = {
    kind: "document" as const,
    ref: "src-p01",
    sourceId: "src-p01",
    label: "P01",
    quote: "N\u1ed9i th\u00e0nh: 30k m\u1ed9t \u0111\u01a1n",
}
/** An internal document's evidence (R1 internal). */
const R1 = {
    kind: "document" as const,
    ref: "src-r1",
    sourceId: "src-r1",
    label: "R1",
    quote: "N\u1ed9i th\u00e0nh 30.000 \u0111",
}

/** The inner-city fee of branch 1 in force, internal (9d8cca0e in the walk). */
const innerFee = (changes: Parameters<typeof facts.rowOf>[0] = {}) =>
    facts.rowOf({
        id: "9d8cca0e",
        status: "active",
        subjectKey: "giao-hang-noi-thanh",
        subjectLabel: "Giao h\u00e0ng n\u1ed9i th\u00e0nh",
        attribute: "phi-giao-hang",
        attributeLabel: "ph\u00ed giao h\u00e0ng",
        value: "30.000 \u0111 m\u1ed7i \u0111\u01a1n",
        valueNumber: "30000",
        sourceKind: "document",
        trust: 75,
        evidence: [R1],
        decidedBy: "Ada",
        decidedAt: new Date(facts.AT),
        ...changes,
    })

describe("truth integrity: who may know follows the evidence (D-BR-1)", () => {
    afterEach(() => relationsDouble.carry.mockClear())

    it("makes the NEXT VERSION public when a public document repeats an internal truth (P01 over 9d8cca0e)", async () => {
        const active = innerFee()
        const tx = fakeTransaction(
            mockEntityManager({ find: [BrainFactEntity, [active]], update: [BrainFactEntity, { affected: 1 }] }),
        )
        const widened = {
            ...innerFee({ id: "v2", scope: "public", supersedesId: "9d8cca0e", evidence: [R1, P01] }),
            version: 2,
        }
        const [supersede, insert] = queueQueryBuilders(tx.em, [
            answered({ ...active, status: "superseded" }),
            answered(widened),
        ])
        const { service, hook } = await build(tx.em)

        const result = await service.propose(facts.WS, {
            subjectLabel: "Giao h\u00e0ng n\u1ed9i th\u00e0nh",
            attributeLabel: "ph\u00ed giao h\u00e0ng",
            value: "30k m\u1ed7i \u0111\u01a1n",
            scope: "public",
            sourceKind: "document",
            autoApply: false,
            evidence: [P01],
            proposedBy: "P01",
        })

        expect(result).toMatchObject({
            outcome: "reinforced",
            fact: { id: "v2", scope: "public", supersedesId: "9d8cca0e" },
        })
        expect(setOf(supersede)).toEqual(evaluatedValues(SUPERSEDE))
        expect(valuesOf(insert)).toMatchObject({
            scope: "public",
            status: "active",
            value: "30.000 \u0111 m\u1ed7i \u0111\u01a1n",
            supersedesId: "9d8cca0e",
            decidedBy: "NIVO",
            version: 1,
            decisionNote:
                "Who reads it changed: internal -> public (a source read by a wider audience states the same value)",
        })
        expect(evidenceOf(insert)).toEqual([R1, P01])
        expect(relationsDouble.carry.mock.calls.map((call) => call.slice(1))).toEqual([[facts.WS, "9d8cca0e", "v2"]])
        expect(hook.told).toEqual([["v2"]])
    })

    it("strict area = audience: an internal document's NEW value for a public truth is filed INTERNAL (it names the public value it disagrees with; no silent public exposure)", async () => {
        const em = mockEntityManager({
            find: [
                [BrainFactEntity, [innerFee({ scope: "public" })]],
                [BrainFactEntity, []],
            ],
        })
        const [insert] = queueQueryBuilders(em, [
            answered(innerFee({ id: "p2", status: "proposed", scope: "internal", value: "35k" })),
        ])
        const { service } = await build(em)

        await service.propose(facts.WS, {
            subjectLabel: "Giao h\u00e0ng n\u1ed9i th\u00e0nh",
            attributeLabel: "ph\u00ed giao h\u00e0ng",
            value: "35k",
            sourceKind: "document",
            autoApply: false,
            evidence: [R1],
            proposedBy: "I05",
        })

        expect(valuesOf(insert)).toMatchObject({ scope: "internal", conflictWith: "9d8cca0e" })
    })
})

describe("truth integrity: the founder's switch outranks the evidence (D-BR-1)", () => {
    afterEach(() => relationsDouble.carry.mockClear())

    it("keeps the audience the founder set with the switch", async () => {
        const switched = innerFee({ decisionNote: "Who reads it changed: public -> internal", decidedBy: "Ada" })
        const em = mockEntityManager({
            find: [BrainFactEntity, [switched]],
            update: [BrainFactEntity, { affected: 0 }],
        })
        const [grow] = queueQueryBuilders(em, [answered(switched)])
        const { service, hook } = await build(em)

        await expect(
            service.propose(facts.WS, {
                subjectLabel: "Giao h\u00e0ng n\u1ed9i th\u00e0nh",
                attributeLabel: "ph\u00ed giao h\u00e0ng",
                value: "30k m\u1ed7i \u0111\u01a1n",
                scope: "public",
                sourceKind: "document",
                autoApply: false,
                evidence: [P01],
                proposedBy: "P01",
            }),
        ).resolves.toMatchObject({ outcome: "reinforced", fact: { id: "9d8cca0e", scope: "internal" } })
        expect(setOf(grow)).not.toHaveProperty("scope")
        expect(hook.told).toEqual([])
    })
})

describe("truth integrity: a duplicate in other words joins the truth, and old data is repaired (D-BR-1, D-BR-9)", () => {
    afterEach(() => relationsDouble.carry.mockClear())

    it("merges a public duplicate in other words into the internal truth and makes it public (88af69d0 into 9d8cca0e)", async () => {
        const duplicate = facts.rowOf({
            id: "88af69d0",
            subjectKey: "giao-hang-noi-thanh-cn1",
            subjectLabel: "Giao h\u00e0ng n\u1ed9i th\u00e0nh (chi nh\u00e1nh 1)",
            attribute: "phi-giao-hang",
            value: "30k m\u1ed7i \u0111\u01a1n",
            scope: "public",
            sourceKind: "document",
            trust: 75,
            evidence: [P01],
        })
        const into = innerFee()
        const tx = fakeTransaction(
            mockEntityManager({
                findOne: [
                    [BrainFactEntity, duplicate],
                    [BrainFactEntity, into],
                ],
                update: [BrainFactEntity, { affected: 1 }],
            }),
        )
        const widened = { ...innerFee({ id: "v2", scope: "public", supersedesId: "9d8cca0e" }), version: 2 }
        const [reject, , insert] = queueQueryBuilders(tx.em, [
            answered({ ...duplicate, status: "rejected" }),
            answered({ ...into, status: "superseded" }),
            answered(widened),
        ])
        const { service, hook } = await build(tx.em)

        await expect(service.mergeDuplicate(facts.WS, "88af69d0", "9d8cca0e")).resolves.toMatchObject({
            id: "v2",
            scope: "public",
        })
        expect(setOf(reject)).toMatchObject({
            status: "rejected",
            decidedBy: "NIVO",
            decisionNote:
                'Same truth, same value as "Giao h\u00e0ng n\u1ed9i th\u00e0nh / ph\u00ed giao h\u00e0ng": its source was added there',
        })
        expect(valuesOf(insert)).toMatchObject({ scope: "public", supersedesId: "9d8cca0e" })
        expect(evidenceOf(insert)).toEqual([R1, P01])
        expect(hook.told).toEqual([["v2"]])
    })

    it("joins a duplicate to a truth SCHEDULED for a later start: evidence and the wider audience in place, announced (Round W, D-W-2)", async () => {
        const duplicate = facts.rowOf({
            id: "dup-window",
            subjectKey: "phu-thu-le",
            attribute: "muc-phu-thu",
            value: "30k",
            scope: "public",
            sourceKind: "document",
            trust: 75,
            evidence: [P01],
        })
        const into = innerFee({ id: "window", status: "scheduled", subjectKey: "phu-thu", attribute: "muc-phu-thu" })
        const em = mockEntityManager({
            findOne: [
                [BrainFactEntity, duplicate],
                [BrainFactEntity, into],
            ],
        })
        const [reject, grow] = queueQueryBuilders(em, [
            answered({ ...duplicate, status: "rejected" }),
            answered({ ...into, scope: "public", evidence: [R1, P01] }),
        ])
        const { service, hook } = await build(em)

        await expect(service.mergeDuplicate(facts.WS, "dup-window", "window")).resolves.toMatchObject({
            id: "window",
            status: "scheduled",
            scope: "public",
        })

        expect(setOf(reject)).toMatchObject({ status: "rejected", decidedBy: "NIVO" })
        // The scheduled truth is grown where it stands (no version in force to keep), its audience widened by the public source.
        expect(setOf(grow)).toMatchObject({ scope: "public", trust: 75 })
        expect(evidenceOf(grow)).toEqual([R1, P01])
        expect(hook.told).toContainEqual(["window"])
    })

    it("joins nothing to a truth that is no longer in force, scheduled or waiting", async () => {
        const duplicate = facts.rowOf({ id: "dup-late", subjectKey: "phu-thu-le", attribute: "muc-phu-thu" })
        const em = mockEntityManager({
            findOne: [
                [BrainFactEntity, duplicate],
                [BrainFactEntity, innerFee({ id: "gone", status: "superseded" })],
            ],
        })
        const { service, hook } = await build(em)

        await expect(service.mergeDuplicate(facts.WS, "dup-late", "gone")).resolves.toBeNull()
        expect(hook.told).toEqual([])
    })
})

describe("truth integrity: the audience repair of data an older build wrote (D-BR-1, maintainBrain)", () => {
    afterEach(() => relationsDouble.carry.mockClear())

    it("gives back to customers the truths an older build left internal: public evidence, and a public line merged over it", async () => {
        const reinforced = innerFee({ evidence: [R1, P01] })
        const winner = facts.rowOf({
            id: "476326c8",
            status: "active",
            subjectKey: "chi-nhanh-thu-duc",
            attribute: "dia-chi",
            value: "s\u1ed1 57 \u0111\u01b0\u1eddng V\u00f5 V\u0103n Ng\u00e2n",
            evidence: [R1],
            decidedBy: "Ada",
            decidedAt: new Date(facts.LATER),
        })
        const loser = facts.rowOf({
            id: "cc2f3e0b",
            status: "rejected",
            subjectKey: "chi-nhanh-2-thu-duc",
            attribute: "dia-chi",
            value: "57 V\u00f5 V\u0103n Ng\u00e2n",
            scope: "public",
            evidence: [P01],
            decidedBy: "Ada",
            decidedAt: new Date(facts.LATER),
            decisionNote: MERGED_NOTE,
        })
        const switched = innerFee({
            id: "kept",
            evidence: [P01],
            decisionNote: "Who reads it changed: public -> internal",
            decidedBy: "Ada",
        })
        const tx = fakeTransaction(
            mockEntityManager({
                find: [
                    [BrainFactEntity, [reinforced, winner, switched]],
                    [BrainFactEntity, [loser]],
                ],
                update: [BrainFactEntity, { affected: 1 }],
            }),
        )
        const [, first, , second] = queueQueryBuilders(tx.em, [
            answered({ ...reinforced, status: "superseded" }),
            answered({ ...reinforced, id: "v2", scope: "public" }),
            answered({ ...winner, status: "superseded" }),
            answered({ ...winner, id: "w2", scope: "public" }),
        ])
        const { service, hook } = await build(tx.em)
        const publicOf = jest.fn((ids: ReadonlyArray<string>) =>
            Promise.resolve(new Set(ids.filter((id) => id === "src-p01"))),
        )

        const widened = await service.repairAudience(facts.WS, publicOf)

        expect(widened.map((fact) => fact.id)).toEqual(["v2", "w2"])
        expect(publicOf).toHaveBeenCalledWith(["src-r1", "src-p01"])
        expect(valuesOf(first)).toMatchObject({ scope: "public", supersedesId: "9d8cca0e" })
        expect(valuesOf(second)).toMatchObject({ scope: "public", supersedesId: "476326c8" })
        expect(evidenceOf(second)).toEqual([R1, P01])
        expect(hook.told).toEqual([["v2", "w2"]])
    })
})

describe("truth integrity: one truth, one value in force (D-BR-4a)", () => {
    it("applies a same-meaning proposal whose truth moved on as a CHANGE of the value in force now (H\u1ea1ng B\u1ea1c 29dbe372)", async () => {
        // 29dbe372 (hang-bac) was flagged the same as 9fecbe74 (khach-hang-bac); 1e3774c9 replaced 9fecbe74 meanwhile.
        const proposal = {
            ...facts.rowOf({
                id: "29dbe372",
                subjectKey: "hang-bac",
                attribute: "giam-gia",
                value: "5%",
                scope: "public",
                conflictWith: "9fecbe74",
            }),
            reviewFlags: ["same_meaning" as const],
        }
        const replaced = facts.rowOf({
            id: "9fecbe74",
            status: "superseded",
            subjectKey: "khach-hang-bac",
            attribute: "giam-gia",
        })
        const now = facts.rowOf({
            id: "1e3774c9",
            status: "active",
            subjectKey: "khach-hang-bac",
            attribute: "giam-gia",
            scope: "public",
        })
        const tx = fakeTransaction(
            mockEntityManager({
                findOne: [
                    [BrainFactEntity, proposal],
                    [BrainFactEntity, replaced],
                    [BrainFactEntity, proposal],
                ],
                find: [
                    [BrainFactEntity, []],
                    [BrainFactEntity, [now]],
                ],
                update: [BrainFactEntity, { affected: 1 }],
            }),
        )
        const [activate] = queueQueryBuilders(tx.em, [answered({ ...proposal, status: "active" })])
        const { service } = await build(tx.em)

        await service.apply(facts.WS, "29dbe372", "Ada")

        expect(tx.em.update.mock.calls).toContainEqual([
            BrainFactEntity,
            activeOf("1e3774c9"),
            SUPERSEDE,
        ])
        expect(setOf(activate)).toMatchObject({ status: "active", supersedesId: "1e3774c9" })
    })
})

describe("truth integrity: what a write door refuses (D-BR-7, D-BR-12)", () => {
    const noDelivery = facts.rowOf({
        status: "active",
        subjectKey: "giao-hang-chi-nhanh-1-can-gio",
        subjectLabel: "Giao h\u00e0ng Chi nh\u00e1nh 1 - C\u1ea7n Gi\u1edd",
        attribute: "giao",
        attributeLabel: "giao",
        value: "Kh\u00f4ng",
        valueNumber: null,
    })

    it("refuses 'maybe' on a yes/no rule written straight into force (A18 not_boolean)", async () => {
        const em = mockEntityManager({
            find: [
                [BrainFactEntity, [noDelivery]],
                [BrainFactEntity, []],
            ],
        })
        const { service } = await build(em)
        await expect(
            service.propose(facts.WS, {
                subjectLabel: "Giao h\u00e0ng Chi nh\u00e1nh 1 - C\u1ea7n Gi\u1edd",
                attributeLabel: "giao",
                value: "maybe",
                sourceKind: "owner",
                proposedBy: "Ada",
            }),
        ).rejects.toMatchObject({ code: BrainFactsErrorCode.ValueNotOfType, params: { problem: "not_boolean" } })
    })

})
