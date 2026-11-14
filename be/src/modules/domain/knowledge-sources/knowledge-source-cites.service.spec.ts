import { Test } from "@nestjs/testing"
import { In } from "typeorm"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BANG_GIA_2026_2_3_VI, BANG_GIA_2026_VI } from "@tests/fixtures/i18n/knowledge-sources-spec.messages"
import { KnowledgeSourceCitesService } from "./knowledge-source-cites.service"
import { KnowledgeSourceEntity } from "./persistence/entities"

const WS = "11111111-1111-4111-8111-111111111111"

const build = async (em: ReturnType<typeof mockEntityManager>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [KnowledgeSourceCitesService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(KnowledgeSourceCitesService)
}

describe("KnowledgeSourceCitesService", () => {
    it("cites the named documents of the workspace in one read by id: title without the part place, last change, size", async () => {
        const row = Object.assign(new KnowledgeSourceEntity(), {
            id: "s2",
            title: BANG_GIA_2026_2_3_VI,
            updatedAt: new Date("2026-11-02T03:00:00.000Z"),
            chunkCount: 150,
            origin: "part:s1",
        })
        const em = mockEntityManager()
        em.find.mockResolvedValue([row])

        const cites = await (await build(em)).of(WS, ["s2", "gone", "s2"])

        expect([...cites.entries()]).toEqual([
            [
                "s2",
                { id: "s2", title: BANG_GIA_2026_VI, updatedAt: "2026-11-02T03:00:00.000Z", passages: 150, part: 2, firstPartId: "s1" },
            ],
        ])
        expect(em.find).toHaveBeenCalledTimes(1)
        expect(em.find).toHaveBeenCalledWith(KnowledgeSourceEntity, {
            select: { id: true, title: true, updatedAt: true, chunkCount: true, origin: true },
            where: { workspaceId: WS, id: In(["s2", "gone"]) },
            take: 2,
        })
    })

    it("reads nothing for no document", async () => {
        const em = mockEntityManager()

        await expect((await build(em)).of(WS, [])).resolves.toEqual(new Map())

        expect(em.find).not.toHaveBeenCalled()
    })
})
