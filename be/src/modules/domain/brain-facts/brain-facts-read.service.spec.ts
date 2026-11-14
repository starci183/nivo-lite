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
        expect(em.find.mock.calls[0]?.[1]).toMatchObject({ where: { status: In(["active", "scheduled"]) }, take: 7 })
    })

    it("FX5: at the start of a scheduled replacement exactly one value is in force, before any upkeep promotes it", async () => {
        const EARLIER = "2026-10-11T10:00:00.000Z"
        const em = mockEntityManager({
            find: [
                BrainFactEntity,
                [
                    // The old fee: its end was set to the new value's start on approval (now).
                    facts.rowOf({
                        id: "old",
                        status: "active",
                        validFrom: new Date(EARLIER),
                        validTo: new Date(facts.AT),
                    }),
                    // The new fee: approved for later, its start has come, still `scheduled`.
                    facts.rowOf({
                        id: "new",
                        status: "scheduled",
                        validFrom: new Date(facts.AT),
                        validTo: new Date(facts.LATER),
                    }),
                    // A plan whose start has not come is not in force.
                    facts.rowOf({ id: "plan", status: "scheduled", validFrom: new Date(facts.LATER) }),
                ],
            ],
        })
        const service = await build(em)

        const inForce = await service.forView(facts.WS, "internal", "sales", null, 50)

        expect(inForce.map((fact) => fact.id)).toEqual(["new"])
    })
}

const registerSearches = () => {
    it("searches the newest 500 facts of the view and the word prefilter's hits of the same view", async () => {
        const service = await build(mockEntityManager())
        const window = jest.spyOn(service, "list").mockResolvedValue([facts.factOf({ status: "active" })])
        const words = jest.spyOn(service, "wordHits").mockResolvedValue([])
        await expect(service.search(facts.WS, "internal", "sales", "i1", "shop", 1)).resolves.toEqual([
            facts.factOf({ status: "active" }),
        ])
        expect(window).toHaveBeenCalledWith(facts.WS, { statuses: ["active", "scheduled"], limit: 500 })
        expect(words).toHaveBeenCalledWith(facts.WS, "internal", "sales", "i1", "shop")
    })

    it("searches the same view by words and meaning: a vector hit with no word in common is found, one outside the view never", async () => {
        const service = await build(mockEntityManager())
        const fee = facts.factOf({
            id: "fee",
            status: "active",
            subjectKey: "giao-hang",
            attribute: "phi-ship",
            value: "30.000 d",
            scope: "public",
        })
        jest.spyOn(service, "list").mockResolvedValue([facts.factOf({ status: "active", scope: "public" }), fee])
        const words = jest.spyOn(service, "wordHits").mockResolvedValue([])
        const near = [
            { fact: fee, distance: 0.3 },
            { fact: facts.factOf({ id: "hidden", status: "active" }), distance: 0.01 },
        ]
        await expect(
            service.searchHybrid(facts.WS, "customer", "chatbot", null, "tien van chuyen", near, 5),
        ).resolves.toEqual([fee])
        expect(words).toHaveBeenCalledWith(facts.WS, "customer", "chatbot", null, "tien van chuyen")
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
    it("counts the cards of the waiting proposals by ONE SQL count of distinct keys (exact above 5,000 proposals), never reading rows", async () => {
        const em = mockEntityManager()
        const [count] = queueQueryBuilders(em, [{ getRawOne: { cards: "7312" } }])
        const service = await build(em)

        await expect(service.waitingCards(facts.WS)).resolves.toBe(7312)

        expect(count?.callsOf("select")).toEqual([["COUNT(DISTINCT (f.subject_key, f.attribute))::int", "cards"]])
        expect(count?.callsOf("where")).toEqual([
            ["f.workspaceId = :workspaceId AND f.status = :status", { workspaceId: facts.WS, status: "proposed" }],
        ])
        expect(em.find).not.toHaveBeenCalled()
    })
}

describe("BrainFactsReadService", () => {
    registerWaiting()
    registerReads()
    registerViews()
    registerSearches()
    registerSources()
})

describe("BrainFactsReadService ofInstance", () => {
    it("reads the facts kept for one agent instance alone in the statuses asked, never the shared ones", async () => {
        const em = mockEntityManager({ find: [BrainFactEntity, [facts.rowOf()]] })
        const service = await build(em)

        await expect(service.ofInstance(facts.WS, "i1", ["active", "scheduled"])).resolves.toEqual([facts.factOf()])

        expect(namedCalls(em.find.mock.calls)).toEqual([
            [
                "BrainFactEntity",
                {
                    where: { workspaceId: facts.WS, installationId: "i1", status: In(["active", "scheduled"]) },
                    order: { createdAt: "ASC", id: "ASC" },
                    take: 2000,
                },
            ],
        ])
    })
})

describe("BrainFactsReadService truth graph reads", () => {
    it("reads the facts born from one chunk of a document in one containment read on the evidence index", async () => {
        const em = mockEntityManager()
        const [read] = queueQueryBuilders(em, [{ getMany: [facts.rowOf({ id: "ship" })] }])
        const service = await build(em)

        await expect(service.bornFrom(facts.WS, "doc-1", "h-ship", ["active", "proposed"])).resolves.toMatchObject([
            { id: "ship" },
        ])
        const [condition, parameters] = read?.callsOf("where")[0] ?? []
        expect(condition).toBe(
            "f.workspaceId = :workspaceId AND f.status IN (:...statuses) AND f.evidence @> :pattern::jsonb",
        )
        expect(parameters).toEqual({
            workspaceId: facts.WS,
            statuses: ["active", "proposed"],
            pattern: JSON.stringify([{ kind: "document", ref: "doc-1", chunkHash: "h-ship" }]),
        })
    })

    it("reads facts by id inside the workspace only, each id once, and nothing for none", async () => {
        const em = mockEntityManager({ find: [BrainFactEntity, [facts.rowOf()]] })
        const service = await build(em)

        await expect(service.byIds(facts.WS, [])).resolves.toEqual([])
        await service.byIds(facts.WS, ["f1", "f1", "f2"])

        expect(em.find.mock.calls[0]?.[1]).toEqual({ where: { workspaceId: facts.WS, id: In(["f1", "f2"]) }, take: 2 })
    })
})

describe("BrainFactsReadService dueWorkspaces: what the timed brain upkeep visits (BR1)", () => {
    it("answers each workspace once where a scheduled fact's start has come or a fact's end has passed, bounded", async () => {
        const em = mockEntityManager()
        const [read] = queueQueryBuilders(em, [{ getRawMany: [{ workspaceId: facts.WS }, { workspaceId: "ws-2" }] }])
        const service = await build(em)

        await expect(service.dueWorkspaces(200)).resolves.toEqual([facts.WS, "ws-2"])

        expect(read?.callsOf("select")).toEqual([["f.workspaceId", "workspaceId"]])
        expect(read?.callsOf("distinct")).toEqual([[true]])
        expect(read?.callsOf("where")).toEqual([
            ["((f.status = 'scheduled' AND f.validFrom <= now()) OR (f.status = 'active' AND f.validTo < now()))"],
        ])
        expect(read?.callsOf("limit")).toEqual([[200]])
    })
})

describe("BrainFactsReadService.searchHybrid with thousands of facts in force", () => {
    it("finds by meaning a fact in force OUTSIDE the newest 500 (thousands in force), held to the same view rules", async () => {
        const service = await build(mockEntityManager())
        const newest = Array.from({ length: 500 }, (_, index) =>
            facts.factOf({
                id: `new-${String(index)}`,
                status: "active",
                scope: "public",
                subjectKey: `item-${String(index)}`,
            }),
        )
        jest.spyOn(service, "list").mockResolvedValue(newest)
        jest.spyOn(service, "wordHits").mockResolvedValue([])
        const old = facts.factOf({
            id: "old",
            status: "active",
            scope: "public",
            subjectKey: "giao-hang",
            attribute: "phi-ship",
        })
        const ended = facts.factOf({
            id: "ended",
            status: "active",
            scope: "public",
            validTo: "2026-10-01T00:00:00.000Z",
        })
        const internal = facts.factOf({ id: "internal", status: "active", scope: "internal" })
        const waiting = facts.factOf({ id: "waiting", status: "proposed", scope: "public" })
        const near = [old, ended, internal, waiting].map((fact) => ({ fact, distance: 0.1 }))

        const found = await service.searchHybrid(facts.WS, "customer", "chatbot", null, "tien van chuyen", near, 5)

        expect(found.map((fact) => fact.id)).toEqual(["old"])
    })
})

describe("Owner order 2026-11-11 item 5: never two values for one truth, at any instant", () => {
    const EARLIER = "2026-10-01T00:00:00.000Z"

    it("a scheduled value whose start has come shadows the active value it takes over, before any upkeep tick", async () => {
        const em = mockEntityManager({
            find: [
                BrainFactEntity,
                [
                    // Edited now while the scheduled value waited (section 0, Q3): its end was never set to the scheduled start.
                    facts.rowOf({
                        id: "edited",
                        status: "active",
                        value: "31k",
                        validFrom: new Date(EARLIER),
                        validTo: new Date(facts.LATER),
                    }),
                    facts.rowOf({
                        id: "started",
                        status: "scheduled",
                        value: "35k",
                        validFrom: new Date(facts.AT),
                        validTo: new Date(facts.LATER),
                    }),
                ],
            ],
        })
        const service = await build(em)

        const read = await service.forView(facts.WS, "internal", "sales", null, 50)

        expect(read.map((fact) => fact.id)).toEqual(["started"])
    })

    it("a started scheduled value also shadows the fact its approval named in another key (a confirmed same-meaning merge)", async () => {
        const em = mockEntityManager({
            find: [
                BrainFactEntity,
                [
                    facts.rowOf({ id: "other-key", status: "active", subjectKey: "giao-hang", attribute: "phi" }),
                    facts.rowOf({
                        id: "merged",
                        status: "scheduled",
                        validFrom: new Date(facts.AT),
                        supersedesId: "other-key",
                    }),
                ],
            ],
        })

        const read = await (await build(em)).forView(facts.WS, "internal", "sales", null, 50)

        expect(read.map((fact) => fact.id)).toEqual(["merged"])
    })

    it("FX6 question: an agent's own instance value shadows the workspace-wide one FOR THAT AGENT ONLY", async () => {
        const rows = [
            facts.rowOf({ id: "shop-wide", status: "active", value: "30k", installationId: null }),
            facts.rowOf({ id: "sales-1", status: "active", value: "35k", installationId: "inst-sales-1" }),
        ]
        const service = await build(mockEntityManager({ find: [BrainFactEntity, rows] }))

        // The instance the value is kept for reads its own value only.
        const own = await service.forView(facts.WS, "internal", "sales", "inst-sales-1", 50)
        expect(own.map((fact) => fact.id)).toEqual(["sales-1"])
        // Another instance of the same module, and a single-instance agent, read the shop's value.
        const other = await service.forView(facts.WS, "internal", "sales", "inst-sales-2", 50)
        expect(other.map((fact) => fact.id)).toEqual(["shop-wide"])
        const single = await service.forView(facts.WS, "internal", "accounting", null, 50)
        expect(single.map((fact) => fact.id)).toEqual(["shop-wide"])
    })
})
