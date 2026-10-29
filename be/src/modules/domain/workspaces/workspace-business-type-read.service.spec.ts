import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { WorkspaceEntity } from "./persistence/entities"
import { WorkspaceBusinessTypeReadService } from "./workspace-business-type-read.service"

const build = async (found: WorkspaceEntity | null) => {
    const em = mockEntityManager({ findOne: [WorkspaceEntity, found] })
    const moduleRef = await Test.createTestingModule({
        providers: [WorkspaceBusinessTypeReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { reader: moduleRef.get(WorkspaceBusinessTypeReadService), em }
}

describe("WorkspaceBusinessTypeReadService", () => {
    it.each<readonly [string, string | null]>([
        ["the chosen type", "cafe"],
        ["null when none was chosen", null],
    ])("answers %s", async (_name, businessType) => {
        const { reader, em } = await build(Object.assign(new WorkspaceEntity(), { id: "ws-1", businessType }))

        await expect(reader.businessTypeOf("ws-1")).resolves.toBe(businessType)
        expect(em.findOne).toHaveBeenCalledWith(WorkspaceEntity, {
            select: { id: true, businessType: true },
            where: { id: "ws-1" },
        })
    })

    it("answers null for an unknown workspace", async () => {
        const { reader } = await build(null)

        await expect(reader.businessTypeOf("ws-x")).resolves.toBeNull()
    })
})
