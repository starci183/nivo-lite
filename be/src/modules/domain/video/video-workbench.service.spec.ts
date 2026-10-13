import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { VideoMediaService } from "./video-media.service"
import { VideoWorkbenchService } from "./video-workbench.service"

const build = async () => {
    const entityManager = mockEntityManager()
    const members = mock<WorkspaceMembersService>()
    const media = mock<VideoMediaService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            VideoWorkbenchService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: VideoMediaService, useValue: media },
        ],
    }).compile()
    return { service: moduleRef.get(VideoWorkbenchService), entityManager, members, media }
}

describe("VideoWorkbenchService", () => {
    describe("scope", () => {
        it("scope has its first case written", async () => {
            const { service } = await build()
            expect(service.scope).toBeInstanceOf(Function)
        })
    })

    describe("list", () => {
        it("list has its first case written", async () => {
            const { service } = await build()
            expect(service.list).toBeInstanceOf(Function)
        })
    })

    describe("get", () => {
        it("get has its first case written", async () => {
            const { service } = await build()
            expect(service.get).toBeInstanceOf(Function)
        })
    })

    describe("managed", () => {
        it("managed has its first case written", async () => {
            const { service } = await build()
            expect(service.managed).toBeInstanceOf(Function)
        })
    })

    describe("brand", () => {
        it("brand has its first case written", async () => {
            const { service } = await build()
            expect(service.brand).toBeInstanceOf(Function)
        })
    })

    describe("sources", () => {
        it("sources has its first case written", async () => {
            const { service } = await build()
            expect(service.sources).toBeInstanceOf(Function)
        })
    })

    describe("figures", () => {
        it("figures has its first case written", async () => {
            const { service } = await build()
            expect(service.figures).toBeInstanceOf(Function)
        })
    })
})
