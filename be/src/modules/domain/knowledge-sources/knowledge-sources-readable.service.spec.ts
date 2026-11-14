import { Test } from "@nestjs/testing"
import { Brackets, In } from "typeorm"
import type { WhereExpressionBuilder } from "typeorm"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { readable } from "@tests/fixtures/builders/knowledge-sources.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { PASSAGE_JOIN, customerTextOf } from "./customer-text.policy"
import { KnowledgeSourcesReadableService } from "./knowledge-sources-readable.service"
import type { ReadableSourceProjection } from "./persistence/knowledge-source.projection"

const WS = "11111111-1111-4111-8111-111111111111"
const AT = "2026-10-12T10:00:00.000Z"
const READY = { workspaceId: WS, status: In(["ready", "extracting_facts"]) }
const OF_DOC = "FROM public.knowledge_chunks c WHERE c.source_id = ks.id AND c.workspace_id = ks.workspace_id"
/** The condition that makes a fully withheld document absent for a customer view (BR2). */
const SERVED = `(NOT EXISTS (SELECT 1 ${OF_DOC}) OR EXISTS (SELECT 1 ${OF_DOC} AND c.customer_ready))`

const readableRowOf = builder<ReadableSourceProjection>({
    id: "shared",
    title: "T",
    topic: null,
    kind: "text",
    visibility: "public",
    content: "c",
    module: null,
    installationId: null,
    updatedAt: AT,
})

/** A manager that hands out one fake statement per createQueryBuilder call, in order. */
const build = async (...answers: Array<QueryBuilderAnswers>) => {
    const em = mockEntityManager()
    const fakes = queueQueryBuilders(em, answers)
    const moduleRef = await Test.createTestingModule({
        providers: [KnowledgeSourcesReadableService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { service: moduleRef.get(KnowledgeSourcesReadableService), em, fakes }
}

/** The where-conditions the module and instance brackets of a statement apply. */
const conditionsOf = (andWheres: ReadonlyArray<ReadonlyArray<unknown>>): Array<unknown> => {
    const conditions: Array<unknown> = []
    const scope = mock<WhereExpressionBuilder>()
    scope.where.mockImplementation((...args: Array<unknown>) => (conditions.push(args), scope))
    scope.orWhere.mockImplementation((...args: Array<unknown>) => (conditions.push(args), scope))
    for (const [brackets] of andWheres) if (brackets instanceof Brackets) brackets.whereFactory(scope)
    return conditions
}

describe("KnowledgeSourcesReadableService", () => {
    it("counts documents allowed for each audience and defaults an absent count to zero", async () => {
        const { service, em, fakes } = await build({ getCount: 3 }, { getCount: 3 }, { getCount: 0 })
        const scope = { workspaceId: WS, module: "chatbot", installationId: null, audience: "customer" as const }

        await expect(service.countReadable(scope, "internal")).resolves.toBe(0)
        await expect(service.countReadable(scope, "public")).resolves.toBe(3)
        await expect(service.countReadable({ ...scope, audience: "internal" }, "internal")).resolves.toBe(3)
        await expect(service.countReadable({ ...scope, audience: "internal" }, "public")).resolves.toBe(0)

        expect(em.createQueryBuilder).toHaveBeenCalledTimes(3)
        expect(fakes[0]?.callsOf("where")).toEqual([[READY]])
        expect(fakes[0]?.callsOf("andWhere")).toEqual([
            [expect.any(Brackets)],
            [expect.any(Brackets)],
            [{ visibility: "public" }],
            [SERVED],
            [{ visibility: "public" }],
        ])
        expect(fakes[1]?.callsOf("andWhere")).toEqual([
            [expect.any(Brackets)],
            [expect.any(Brackets)],
            [{ visibility: "internal" }],
        ])
    })

    it("allows internal readers shared and matching documents and rejects a different module or instance", async () => {
        const { service, fakes } = await build({
            getRawMany: [
                readableRowOf(),
                readableRowOf({ id: "private", module: "chatbot", installationId: "i1", visibility: "internal" }),
                readableRowOf({ id: "legacy", visibility: "legacy", content: null }),
                readableRowOf({ id: "other-module", module: "sales" }),
                readableRowOf({ id: "other-instance", module: "chatbot", installationId: "i2" }),
            ],
        })

        await expect(
            service.readableFor({ workspaceId: WS, module: "chatbot", installationId: "i1", audience: "internal" }, 8),
        ).resolves.toEqual([
            readable,
            { ...readable, id: "private", visibility: "internal" },
            { ...readable, id: "legacy", visibility: "internal", content: "" },
        ])

        expect(fakes[0]?.callsOf("where")).toEqual([[READY]])
        expect(fakes[0]?.callsOf("andWhere")).toEqual([[expect.any(Brackets)], [expect.any(Brackets)]])
        expect(fakes[0]?.callsOf("addSelect")).toContainEqual(["ks.updated_at::text", "updatedAt"])
        expect(conditionsOf(fakes[0]?.callsOf("andWhere") ?? [])).toEqual([
            ["ks.module IS NULL"],
            ["ks.module = :module", { module: "chatbot" }],
            ["ks.installationId IS NULL"],
            ["ks.installationId = :installationId", { installationId: "i1" }],
        ])
        expect(fakes[0]?.callsOf("orderBy")).toEqual([["ks.createdAt", "ASC"]])
        expect(fakes[0]?.callsOf("limit")).toEqual([[8]])
    })

    it("allows customer readers only public documents and a shared scope rejects instance documents", async () => {
        const { service, fakes } = await build({
            getRawMany: [
                readableRowOf(),
                readableRowOf({ id: "private", visibility: "internal" }),
                readableRowOf({ id: "instance", installationId: "i1" }),
            ],
        })

        await expect(
            service.readableFor({ workspaceId: WS, module: "chatbot", installationId: null, audience: "customer" }, 5),
        ).resolves.toEqual([readable])
        expect(fakes[0]?.callsOf("andWhere")).toEqual([
            [expect.any(Brackets)],
            [expect.any(Brackets)],
            [{ visibility: "public" }],
            [SERVED],
        ])
    })
})

describe("KnowledgeSourcesReadableService: the trust gate on the whole-document read (BR1)", () => {
    const customer = { workspaceId: WS, module: "chatbot", installationId: null, audience: "customer" as const }
    const docs = {
        getRawMany: [
            { ...readableRowOf({ id: "reviewed", content: "Hours 8-20. Fee 30.000 d" }), passages: 2, served: 2, servedText: "x" },
            { ...readableRowOf({ id: "partly", content: "Hours 8-20. Rush: ask us" }), passages: "2", served: "1", servedText: "Hours 8-20." },
            { ...readableRowOf({ id: "unreviewed", content: "New price list" }), passages: 1, served: 0, servedText: null },
            { ...readableRowOf({ id: "no-passage", content: "" }), passages: 0, served: 0, servedText: null },
        ],
    }
    it("serves a customer agent only what the passage search serves it: whole text, served passages only, or nothing", async () => {
        const { service, fakes } = await build(docs)

        const found = await service.readableFor(customer, 5)

        expect(found.map((one) => [one.id, one.content])).toEqual([
            ["reviewed", "Hours 8-20. Fee 30.000 d"],
            ["partly", "Hours 8-20."],
            ["no-passage", ""],
        ])
        expect(fakes[0]?.callsOf("addSelect")).toEqual(
            expect.arrayContaining([
                [`(SELECT count(*)::int ${OF_DOC})`, "passages"],
                [`(SELECT count(*)::int ${OF_DOC} AND c.customer_ready)`, "served"],
                [`(SELECT string_agg(c.content, :passageJoin ORDER BY c.ord) ${OF_DOC} AND c.customer_ready)`, "servedText"],
            ]),
        )
        expect(fakes[0]?.callsOf("setParameter")).toEqual([["passageJoin", PASSAGE_JOIN]])
    })

    it.each([
        [{ passages: 3, served: 3, servedText: "a" }, "whole"],
        [{ passages: 3, served: 1, servedText: "a" }, "a"],
        [{ passages: 3, served: 0, servedText: null }, null],
        [{ passages: 0, served: 0, servedText: null }, "whole"],
    ])("customerTextOf(%j) = %s", (gate, expected) => {
        expect(customerTextOf("whole", gate)).toBe(expected)
    })

    it("leaves internal readers the whole text (the search marks their unreviewed hits) and reads no gate for them", async () => {
        const { service, em, fakes } = await build(docs)

        const found = await service.readableFor({ ...customer, audience: "internal" }, 5)

        expect(found.map((one) => one.id)).toEqual(["reviewed", "partly", "unreviewed", "no-passage"])
        expect(em.createQueryBuilder).toHaveBeenCalledTimes(1)
        expect(fakes[0]?.callsOf("setParameter")).toEqual([])
        expect(fakes[0]?.callsOf("andWhere")).not.toContainEqual([SERVED])
    })

    it("leaves a fully withheld document out of a customer view's list and count, not only its text (BR2)", async () => {
        const { service, fakes } = await build({ getRawMany: [readableRowOf()] }, { getCount: 1 })

        await service.summariesFor(customer, 50)
        await expect(service.countReadable(customer, "public")).resolves.toBe(1)

        expect(fakes[0]?.callsOf("andWhere")).toContainEqual([SERVED])
        expect(fakes[1]?.callsOf("andWhere")).toContainEqual([SERVED])
    })

    it("keeps the team's list of the same documents ungated: the owner still sees what a customer agent leaves out", async () => {
        const { service, fakes } = await build({ getRawMany: [readableRowOf()] }, { getCount: 1 })

        await service.summariesFor({ ...customer, audience: "internal" }, 50)
        await service.countReadable({ ...customer, audience: "internal" }, "public")

        expect(fakes[0]?.callsOf("andWhere")).not.toContainEqual([SERVED])
        expect(fakes[1]?.callsOf("andWhere")).not.toContainEqual([SERVED])
    })
})

describe("KnowledgeSourcesReadableService summaries", () => {
    it("lists the documents of the scope without their text, newest change first, whatever the audience reads", async () => {
        const { service, fakes } = await build({
            getRawMany: [
                readableRowOf(),
                readableRowOf({ id: "private", visibility: "internal" }),
                readableRowOf({ id: "other-module", module: "sales" }),
            ],
        })

        const found = await service.summariesFor(
            { workspaceId: WS, module: "chatbot", installationId: null, audience: "internal" },
            50,
        )

        expect(found.map((one) => [one.id, one.visibility])).toEqual([
            ["shared", "public"],
            ["private", "internal"],
        ])
        expect(found[0]).not.toHaveProperty("content")
        expect(fakes[0]?.callsOf("orderBy")).toEqual([["ks.updatedAt", "DESC"]])
        expect(fakes[0]?.callsOf("limit")).toEqual([[50]])
    })
})
