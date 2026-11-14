import { WorkspaceTimeZoneService } from "@modules/domain/workspace-settings"
import * as facts from "@tests/fixtures/builders/brain-facts.builder"
import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"
import type { FakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder.builder"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { BrainFactsMaintenanceService } from "./brain-facts-maintenance.service"
import { BrainFactsReadService } from "./brain-facts-read.service"
import { BrainFactsService } from "./brain-facts.service"
import { InForceBoundService } from "./in-force-bound.service"
import { BrainFactRelationsService } from "./brain-fact-relations.service"
import type { FactInput } from "./brain-facts.contracts"
import { BrainFactEntity } from "./persistence/entities"

/**
 * THE CRITIQUE ACROSS THE TWO AREAS (owner 2026-11-12): it is only duplicates (merge) and contradictions (ask), across both areas too. A
 * truth is one key (subject, attribute, instance); its audience is not part of the key, so a public and an internal value of one key are
 * one truth with two values: the founder is asked, never "two audiences, two values". Proven on the store's own propose door with a
 * laundry's wash price; no new logic.
 */
const build = async (em: MockEntityManager): Promise<BrainFactsService> => {
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
    return moduleRef.get(BrainFactsService)
}

const valuesOf = (fake: FakeQueryBuilder | undefined) => evaluatedValues(fake?.callsOf("values")[0]?.[0])

/** The wash price of the laundry in force, read from one area. */
const washPrice = (scope: "public" | "internal") =>
    facts.rowOf({
        id: "wash",
        status: "active",
        subjectKey: "wash",
        subjectLabel: "Wash",
        attribute: "price",
        attributeLabel: "Price",
        value: "40.000 d per kg",
        valueNumber: "40000",
        scope,
        sourceKind: "document",
        trust: 75,
        evidence: [{ kind: "document", ref: `doc-${scope}`, sourceId: `doc-${scope}`, label: "Price list" }],
    })

/** A line of a document of one area that states the wash price (`proposalOf` states `public` for a public document only). */
const lineOf = (area: "public" | "internal", value: string): FactInput => ({
    subjectLabel: "Wash",
    attributeLabel: "Price",
    value,
    ...(area === "public" ? { scope: "public" as const } : {}),
    sourceKind: "document",
    autoApply: false,
    evidence: [{ kind: "document", ref: `new-${area}`, sourceId: `new-${area}`, label: "Price list" }],
    proposedBy: "Price list",
})

/** A key holding `active` and no waiting value, with the row the filing answers. */
const keyHolding = async (active: BrainFactEntity, filed: BrainFactEntity) => {
    const em = mockEntityManager({
        find: [
            [BrainFactEntity, [active]],
            [BrainFactEntity, []],
        ],
        update: [BrainFactEntity, { affected: 0 }],
    })
    const [insert] = queueQueryBuilders(em, [{ execute: { raw: [filed] } }])
    return { insert, service: await build(em) }
}

describe("BrainFactsService: public and internal values that differ for one key ask the founder", () => {
    it("an internal document's other value for a public truth waits for the founder against it, never beside it", async () => {
        const { insert, service } = await keyHolding(
            washPrice("public"),
            facts.rowOf({ id: "w2", status: "proposed", conflictWith: "wash" }),
        )

        const result = await service.propose(facts.WS, lineOf("internal", "45.000 d per kg"))

        expect(result).toMatchObject({ outcome: "conflict", created: true })
        expect(valuesOf(insert)).toMatchObject({ conflictWith: "wash", proposalKind: "set" })
    })

    it("a public document's other value for an internal truth waits for the founder the same way", async () => {
        const { insert, service } = await keyHolding(
            washPrice("internal"),
            facts.rowOf({ id: "w2", status: "proposed", scope: "public", conflictWith: "wash" }),
        )

        const result = await service.propose(facts.WS, lineOf("public", "45.000 d per kg"))

        expect(result).toMatchObject({ outcome: "conflict", created: true })
        expect(valuesOf(insert)).toMatchObject({ conflictWith: "wash", scope: "public" })
    })

    it("the same value from the internal area merges into the public truth, which stays public (the widest audience)", async () => {
        const { insert, service } = await keyHolding(washPrice("public"), washPrice("public"))

        const result = await service.propose(facts.WS, lineOf("internal", "40.000 d per kg"))

        expect(result).toMatchObject({ outcome: "reinforced", fact: { id: "wash", scope: "public" } })
        expect(insert?.callsOf("insert") ?? []).toEqual([])
    })
})
