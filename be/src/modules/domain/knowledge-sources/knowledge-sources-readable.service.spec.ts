import { Test } from "@nestjs/testing"
import { Brackets, In } from "typeorm"
import type { WhereExpressionBuilder } from "typeorm"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { readable } from "@tests/fixtures/builders/knowledge-sources.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { KnowledgeSourcesReadableService } from "./knowledge-sources-readable.service"
import type { ReadableSourceProjection } from "./persistence/knowledge-source.projection"

const WS = "11111111-1111-4111-8111-111111111111"
const AT = "2026-10-12T10:00:00.000Z"
const READY = { workspaceId: WS, status: In(["ready", "extracting_facts"]) }

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
        ])
    })
})
