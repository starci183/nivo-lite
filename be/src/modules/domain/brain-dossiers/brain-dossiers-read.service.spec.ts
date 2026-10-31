import { Test } from "@nestjs/testing"
import { dossierRowOf as rowOf, DOSSIER_WORKSPACE as WS } from "@tests/fixtures/builders/brain-dossiers.builder"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BrainDossiersReadService } from "./brain-dossiers-read.service"
import { BrainDossierEntity } from "./persistence/entities"

const build = async (em: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [BrainDossiersReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(BrainDossiersReadService)
}

describe("BrainDossiersReadService all", () => {
    it("answers every dossier of the workspace by category and position, as stored", async () => {
        const em = mockEntityManager({
            find: [
                BrainDossierEntity,
                [rowOf(), rowOf({ id: "d2", ref: "2", position: 2, name: "Charter", missing: "Signed copy" })],
            ],
        })
        const service = await build(em)

        await expect(service.all(WS)).resolves.toEqual([
            {
                id: "d1",
                ref: "1",
                category: "LEGAL FILES",
                categoryOrder: 1,
                position: 1,
                name: "Registration certificate",
                status: "present",
                existing: "Certificate",
                missing: null,
                drafts: null,
            },
            {
                id: "d2",
                ref: "2",
                category: "LEGAL FILES",
                categoryOrder: 1,
                position: 2,
                name: "Charter",
                status: "present",
                existing: "Certificate",
                missing: "Signed copy",
                drafts: null,
            },
        ])
        expect(em.find).toHaveBeenCalledWith(BrainDossierEntity, {
            where: { workspaceId: WS },
            order: { categoryOrder: "ASC", position: "ASC" },
            take: 500,
        })
    })
})
