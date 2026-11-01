import * as facts from "@tests/fixtures/builders/brain-facts.builder"

import { Test } from "@nestjs/testing"
import { FakeClock, mockEntityManager, queueQueryBuilders } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In, IsNull } from "typeorm"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { namedCalls } from "@tests/fixtures/builders/entity-row.builder"
import { BrainFactsReadService } from "./brain-facts-read.service"
import { BrainFactEntity } from "./persistence/entities"

const build = async (em: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrainFactsReadService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(facts.AT) },
        ],
    }).compile()
    return moduleRef.get(BrainFactsReadService)
}

/** The condition of the facts of the spec key in a status, in the workspace-wide scope unless an installation is named. */
const keyed = (status: string, installationId: string | null = null) => ({
    workspaceId: facts.WS,
    subjectKey: "shop",
    attribute: "hours",
    installationId: installationId ?? IsNull(),
    status,
})

const registerReads = () => {
    it("reads a fact or null and keys its queries by workspace and installation", async () => {
        const em = mockEntityManager({
            findOne: [
                [BrainFactEntity, facts.rowOf()],
                [BrainFactEntity, null],
            ],
            find: [BrainFactEntity, [facts.rowOf()]],
        })
        const service = await build(em)
        await expect(service.get(facts.WS, "f1")).resolves.toEqual(facts.factOf())
        await expect(service.get(facts.WS, "absent")).resolves.toBeNull()
        await expect(service.byKey(facts.WS, "shop", "hours", "proposed", "i1")).resolves.toEqual([facts.factOf()])
        expect(namedCalls(em.findOne.mock.calls)).toEqual([
            ["BrainFactEntity", { where: { workspaceId: facts.WS, id: "f1" } }],
            ["BrainFactEntity", { where: { workspaceId: facts.WS, id: "absent" } }],
        ])
        expect(namedCalls(em.find.mock.calls)).toEqual([
            ["BrainFactEntity", { where: keyed("proposed", "i1"), order: { proposedAt: "DESC" }, take: 50 }],
        ])
    })

    it("reads the workspace-wide facts of a key as IS NULL, never as every installation", async () => {
        const em = mockEntityManager({ find: [BrainFactEntity, []] })

        await (await build(em)).byKey(facts.WS, "shop", "hours", "active", null)

        expect(em.find.mock.calls[0]?.[1]).toMatchObject({ where: { installationId: IsNull() } })
    })

    it("lists with defaults or explicit filters and bounds the result count", async () => {
        const em = mockEntityManager({ find: [BrainFactEntity, [facts.rowOf()]] })
        const service = await build(em)
        await expect(service.list(facts.WS, {})).resolves.toEqual([facts.factOf()])
        await expect(
            service.list(facts.WS, { statuses: ["proposed"], subjectKey: "shop", limit: 3000 }),
        ).resolves.toEqual([facts.factOf()])
        expect(namedCalls(em.find.mock.calls)).toEqual([
            ["BrainFactEntity", { where: { workspaceId: facts.WS }, order: { updatedAt: "DESC" }, take: 500 }],
            [
                "BrainFactEntity",
                {
                    where: { workspaceId: facts.WS, status: In(["proposed"]), subjectKey: "shop" },
                    order: { updatedAt: "DESC" },
                    take: 2000,
                },
            ],
        ])
    })
}

const registerViews = () => {
    it("filters active facts by the current instant and audience", async () => {
        const em = mockEntityManager({
            find: [
                BrainFactEntity,
                [
                    facts.rowOf({ scope: "public", status: "active" }),
                    facts.rowOf({ id: "future", validFrom: new Date(facts.LATER) }),
                    facts.rowOf({ id: "private", scope: "internal" }),
                ],
            ],
        })
        const service = await build(em)
        await expect(service.forView(facts.WS, "customer", "sales", null, 7)).resolves.toEqual([
            facts.factOf({ scope: "public", status: "active" }),
        ])
        expect(em.find.mock.calls[0]?.[1]).toMatchObject({ where: { status: In(["active"]) }, take: 7 })
    })

    it("searches a view of at most 500 active facts", async () => {
        const service = await build(mockEntityManager())
        const view = jest.spyOn(service, "forView").mockResolvedValue([facts.factOf()])
        await expect(service.search(facts.WS, "internal", "sales", "i1", "shop", 1)).resolves.toEqual([facts.factOf()])
        expect(view).toHaveBeenCalledWith(facts.WS, "internal", "sales", "i1", 500)
    })
}

const registerSources = () => {
    it("reads the facts whose evidence cites the documents in one bounded query", async () => {
        const em = mockEntityManager()
        const [read] = queueQueryBuilders(em, [{ getMany: [facts.rowOf()] }])
        const service = await build(em)

        await expect(service.ofSources(facts.WS, ["s1", "s2"], ["active", "proposed"], 3000)).resolves.toEqual([
            facts.factOf(),
        ])

        expect(read?.callsOf("where")).toEqual([
            [
                "f.workspaceId = :workspaceId AND f.status IN (:...statuses) AND EXISTS (SELECT 1 FROM jsonb_array_elements(f.evidence) AS e WHERE e->>'kind' = 'document' AND e->>'ref' = ANY(:sourceIds))",
                { workspaceId: facts.WS, statuses: ["active", "proposed"], sourceIds: ["s1", "s2"] },
            ],
        ])
        expect(read?.callsOf("orderBy")).toEqual([["f.updatedAt", "DESC"]])
        expect(read?.callsOf("limit")).toEqual([[2000]])
    })

    it("reads nothing without documents or statuses", async () => {
        const em = mockEntityManager()
        const service = await build(em)

        await expect(service.ofSources(facts.WS, [], ["active"], 10)).resolves.toEqual([])
        await expect(service.ofSources(facts.WS, ["s1"], [], 10)).resolves.toEqual([])
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
}

const registerWaiting = () => {
    it("counts the cards of the waiting proposals from four columns of each, never the evidence", async () => {
        const em = mockEntityManager({
            find: [
                BrainFactEntity,
                [
                    facts.rowOf({ subjectKey: "shop", attribute: "hours", value: "8-21" }),
                    facts.rowOf({ subjectKey: "shop", attribute: "hours", value: "9-18" }),
                    facts.rowOf({ subjectKey: "shop", attribute: "phone", value: "0901" }),
                ],
            ],
        })
        const service = await build(em)

        await expect(service.waitingCards(facts.WS)).resolves.toBe(2)

        expect(em.find).toHaveBeenCalledWith(BrainFactEntity, {
            select: { subjectKey: true, attribute: true, value: true, proposalKind: true },
            where: { workspaceId: facts.WS, status: "proposed" },
            take: 5000,
        })
    })
}

describe("BrainFactsReadService", () => {
    registerWaiting()
    registerReads()
    registerViews()
    registerSources()
})
