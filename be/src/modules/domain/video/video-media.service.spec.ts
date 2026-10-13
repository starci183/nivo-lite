import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { EntitlementsService } from "@modules/domain/billing"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { SUPABASE_OBJECTS } from "@modules/integrations/supabase"
import type { SupabaseObjectsPort } from "@modules/integrations/supabase"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { VideoMediaService } from "./video-media.service"

const build = async () => {
    const entityManager = mockEntityManager()
    const storage = mock<SupabaseObjectsPort>()
    const members = mock<WorkspaceMembersService>()
    const entitlements = mock<EntitlementsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            VideoMediaService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: SUPABASE_OBJECTS, useValue: storage },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: EntitlementsService, useValue: entitlements },
        ],
    }).compile()
    return { service: moduleRef.get(VideoMediaService), entityManager, storage, members, entitlements }
}

describe("VideoMediaService", () => {
    describe("list", () => {
        it("list has its first case written", async () => {
            const { service } = await build()
            expect(service.list).toBeInstanceOf(Function)
        })
    })

    describe("createUpload", () => {
        it("createUpload has its first case written", async () => {
            const { service } = await build()
            expect(service.createUpload).toBeInstanceOf(Function)
        })
    })

    describe("render", () => {
        it("render has its first case written", async () => {
            const { service } = await build()
            expect(service.render).toBeInstanceOf(Function)
        })
    })

    describe("shareLink", () => {
        it("shareLink has its first case written", async () => {
            const { service } = await build()
            expect(service.shareLink).toBeInstanceOf(Function)
        })
    })
})
