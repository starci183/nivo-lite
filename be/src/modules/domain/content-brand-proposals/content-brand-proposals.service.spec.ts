import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"
import type { BrandProposalClosing } from "./content-brand-proposals.contracts"
import { ContentBrandProposalsService } from "./content-brand-proposals.service"
import { ContentBrandProposalEntity } from "./persistence/entities"

const ROW = {
    id: "p-1",
    workspaceId: "ws-1",
    installationId: "inst-1",
    setupSessionId: null,
    fileName: "guide.pdf",
    fileSize: 4,
    payload: { tone: "Warm" },
    status: "proposed",
    decidedBy: null,
    createdAt: "2026-10-20T00:00:00+00:00",
}
const RECORD = {
    id: "p-1",
    workspaceId: "ws-1",
    installationId: "inst-1",
    setupSessionId: null,
    fileName: "guide.pdf",
    fileSize: 4,
    payload: { tone: "Warm" },
    status: "proposed",
    decidedBy: null,
    createdAt: "2026-10-20T00:00:00+00:00",
}

const build = async (em: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [ContentBrandProposalsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(ContentBrandProposalsService)
}

describe("ContentBrandProposalsService", () => {
    it("stores a proposal with a bounded file name, or answers null", async () => {
        const em = mockEntityManager()
        const [stored] = queueQueryBuilders(em, [{ execute: { raw: [ROW] } }, { execute: { raw: [] } }])
        const service = await build(em)
        const input = {
            workspaceId: "ws-1",
            installationId: "inst-1",
            setupSessionId: null,
            fileName: `${"a".repeat(300)}.pdf`,
            fileSize: 4,
            payload: "{}",
        }

        await expect(service.insert(input)).resolves.toEqual(RECORD)
        await expect(service.insert(input)).resolves.toBeNull()
        expect(evaluatedValues(stored?.callsOf("values")[0]?.[0])).toEqual({
            workspaceId: "ws-1",
            installationId: "inst-1",
            setupSessionId: null,
            fileName: "a".repeat(255),
            fileSize: 4,
            payload: ":payload::jsonb",
        })
        expect(stored?.callsOf("setParameter")).toEqual([["payload", "{}"]])
    })

    it("answers null when the statement hands back no rows at all", async () => {
        const em = mockEntityManager()
        queueQueryBuilders(em, [{ execute: {} }])
        const service = await build(em)
        const input = {
            workspaceId: "ws-1",
            installationId: "inst-1",
            setupSessionId: null,
            fileName: "guide.pdf",
            fileSize: 4,
            payload: "{}",
        }

        await expect(service.insert(input)).resolves.toBeNull()
    })

    it("finds one proposal or null and lists an installation's proposals", async () => {
        const em = mockEntityManager()
        const [one, none, many] = queueQueryBuilders(em, [
            { getRawMany: [ROW] },
            { getRawMany: [] },
            { getRawMany: [ROW] },
        ])
        const service = await build(em)

        await expect(service.find("ws-1", "p-1")).resolves.toEqual(RECORD)
        await expect(service.find("ws-1", "p-1")).resolves.toBeNull()
        await expect(service.list("ws-1", "inst-1")).resolves.toEqual([RECORD])
        expect(one?.callsOf("where")).toEqual([[{ workspaceId: "ws-1", id: "p-1" }]])
        expect(none?.callsOf("limit")).toEqual([[1]])
        expect(many?.callsOf("where")).toEqual([[{ workspaceId: "ws-1", installationId: "inst-1" }]])
        expect(many?.callsOf("orderBy")).toEqual([["p.createdAt", "DESC"]])
        expect(many?.callsOf("limit")).toEqual([[10]])
    })
})

describe("ContentBrandProposalsService", () => {
    it("closes a waiting proposal, null when decided already", async () => {
        const em = mockEntityManager()
        const [closed] = queueQueryBuilders(em, [
            { execute: { raw: [{ ...ROW, status: "applied", decidedBy: "Mai" }] } },
            { execute: { raw: [] } },
        ])
        const service = await build(em)
        const closing: BrandProposalClosing = { status: "applied", payload: "{}", decidedBy: "Mai" }

        await expect(service.close("ws-1", "p-1", closing)).resolves.toMatchObject({
            status: "applied",
            decidedBy: "Mai",
        })
        await expect(service.close("ws-1", "p-1", closing)).resolves.toBeNull()
        expect(em.createQueryBuilder).toHaveBeenCalledWith(ContentBrandProposalEntity, "cbp")
        expect(closed?.callsOf("where")).toEqual([[{ workspaceId: "ws-1", id: "p-1", status: "proposed" }]])
        expect(closed?.callsOf("setParameter")).toEqual([["payload", "{}"]])
        expect(evaluatedValues(closed?.callsOf("set")[0]?.[0])).toEqual({
            status: "applied",
            payload: ":payload::jsonb",
            decidedBy: "Mai",
            decidedAt: "now()",
        })
    })
})
