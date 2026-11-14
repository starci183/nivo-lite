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
import { PRICE_30K_VI, PRICE_50K_VI } from "@tests/fixtures/i18n/brain-facts-spec.messages"
import { BrainFactsMaintenanceService } from "./brain-facts-maintenance.service"
import { BrainFactsReadService } from "./brain-facts-read.service"
import { BrainFactsService } from "./brain-facts.service"
import { InForceBoundService } from "./in-force-bound.service"
import { BrainFactRelationsService } from "./brain-fact-relations.service"
import { SUPERSEDE } from "./fact-write.policy"
import { BrainFactEntity } from "./persistence/entities"

/** The time rules of the write doors of the truth graph (D-BR-16 a date in the shop's clock, D-BR-18 a time-boxed value over a standing one). */

const build = async (em: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrainFactsService,
            { provide: WorkspaceTimeZoneService, useValue: mock<WorkspaceTimeZoneService>({ timeZoneOf: () => Promise.resolve("Asia/Ho_Chi_Minh") }) },
            InForceBoundService,
            BrainFactsReadService,
            BrainFactsMaintenanceService,
            { provide: BrainFactRelationsService, useValue: mock<BrainFactRelationsService>() },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(facts.AT) },
        ],
    }).compile()
    return { service: moduleRef.get(BrainFactsService) }
}

/** The condition of the active fact with this id in the spec workspace. */
const activeOf = (id: string) => ({ workspaceId: facts.WS, id, status: "active" })

/** A write that answered these rows. */
const answered = (...rows: ReadonlyArray<object>) => ({ execute: { raw: rows } })

const valuesOf = (fake: FakeQueryBuilder | undefined) => evaluatedValues(fake?.callsOf("values")[0]?.[0])
const parametersOf = (fake: FakeQueryBuilder | undefined): Readonly<Record<string, unknown>> => {
    const first: unknown = fake?.callsOf("setParameters")[0]?.[0]
    return typeof first === "object" && first !== null ? Object.fromEntries(Object.entries(first)) : {}
}

describe("truth integrity: time (D-BR-16, D-BR-18)", () => {
    it("stores a date with no time as the start of that day in the shop's clock (A6: 2026-12-01)", async () => {
        const em = mockEntityManager({
            find: [
                [BrainFactEntity, []],
                [BrainFactEntity, []],
            ],
        })
        const [insert] = queueQueryBuilders(em, [answered(facts.rowOf())])
        const { service } = await build(em)
        await service.propose(facts.WS, facts.inputOf({ validFrom: "2026-12-01", validTo: "2027-02-12" }))
        expect(parametersOf(insert)).toMatchObject({
            validFrom: "2026-11-30T17:00:00.000Z",
            validTo: "2027-02-11T17:00:00.000Z",
        })
    })

    it("schedules the standing value back when a time-boxed value ends (B10: gold 8 % -> 9 % until 10:05)", async () => {
        const STANDING_END = "2027-10-12T10:00:00.000Z"
        const standing = facts.rowOf({
            id: "eight",
            status: "active",
            value: "8%",
            valueNumber: "8",
            validTo: new Date(STANDING_END),
        })
        const boxed = facts.rowOf({ id: "nine", value: "9%", valueNumber: "9", validTo: new Date(facts.LATER) })
        const tx = fakeTransaction(
            mockEntityManager({
                findOne: [BrainFactEntity, boxed],
                find: [BrainFactEntity, [standing]],
                update: [BrainFactEntity, { affected: 1 }],
            }),
        )
        const [, restore] = queueQueryBuilders(tx.em, [
            answered({ ...boxed, status: "active", supersedesId: "eight" }),
            answered(facts.rowOf({ id: "eight-again", status: "scheduled", value: "8%" })),
        ])
        const { service } = await build(tx.em)

        await service.apply(facts.WS, "nine", "Ada")

        expect(tx.em.update.mock.calls).toContainEqual([
            BrainFactEntity,
            activeOf("eight"),
            SUPERSEDE,
        ])
        expect(valuesOf(restore)).toMatchObject({
            status: "scheduled",
            value: "8%",
            supersedesId: "nine",
            version: null,
            decisionNote: 'Back in force after the time-boxed value "9%" ends',
        })
        expect(parametersOf(restore)).toMatchObject({ validFrom: facts.LATER, validTo: STANDING_END })
    })

    it("restores nothing when the new value states no end", async () => {
        const standing = facts.rowOf({ id: "eight", status: "active", value: "8%" })
        const forGood = facts.rowOf({ id: "nine", value: "9%" })
        const tx = fakeTransaction(
            mockEntityManager({
                findOne: [BrainFactEntity, forGood],
                find: [BrainFactEntity, [standing]],
                update: [BrainFactEntity, { affected: 1 }],
            }),
        )
        const [, extra] = queueQueryBuilders(tx.em, [
            answered({ ...forGood, status: "active" }),
            answered(facts.rowOf()),
        ])
        const { service } = await build(tx.em)
        await service.apply(facts.WS, "nine", "Ada")
        expect(extra?.callsOf("values")).toEqual([])
    })
})

describe("truth integrity: a time-boxed value merged over another key (D-N-5)", () => {
    it("schedules the standing value of ANOTHER key back when a window merged over it ends (D-N-5: the Tet-season fee, P02 over A01)", async () => {
        const STANDING_END = "2027-11-11T14:07:23.495Z"
        // The inner-city delivery fee of branch 1 (30,000 dong) is in force with its default end; the judge linked the Tet-season
        // window written under other words to it.
        const standing = facts.rowOf({
            id: "fee",
            status: "active",
            subjectKey: "giao-hang-noi-thanh-tu-chi-nhanh-1",
            attribute: "phi-giao",
            value: PRICE_30K_VI,
            valueNumber: "30000",
            validTo: new Date(STANDING_END),
        })
        const tet = {
            ...facts.rowOf({
                id: "tet",
                subjectKey: "phi-giao-hang-noi-thanh-tu-chi-nhanh-1",
                attribute: "muc-phi",
                value: PRICE_50K_VI,
                valueNumber: "50000",
                validTo: new Date(facts.LATER),
                conflictWith: "fee",
            }),
            reviewFlags: ["same_meaning" as const],
        }
        const tx = fakeTransaction(
            mockEntityManager({
                findOne: [
                    [BrainFactEntity, tet],
                    [BrainFactEntity, standing],
                    [BrainFactEntity, tet],
                ],
                find: [BrainFactEntity, []],
                update: [BrainFactEntity, { affected: 1 }],
            }),
        )
        const [, restore] = queueQueryBuilders(tx.em, [
            answered({ ...tet, status: "active", supersedesId: "fee" }),
            answered(facts.rowOf({ id: "fee-again", status: "scheduled", value: PRICE_30K_VI })),
        ])
        const { service } = await build(tx.em)

        await service.apply(facts.WS, "tet", "Ada")

        expect(valuesOf(restore)).toMatchObject({ status: "scheduled", value: PRICE_30K_VI, supersedesId: "tet" })
        expect(parametersOf(restore)).toMatchObject({ validFrom: facts.LATER, validTo: STANDING_END })
    })
})
