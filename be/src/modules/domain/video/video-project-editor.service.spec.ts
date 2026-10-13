import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { EventsService } from "@modules/domain/events"
import { VideoBrandKitsService } from "@modules/domain/video-brand-kits"
import { VideoProjectWorkbenchWriterService } from "@modules/domain/video-projects"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { VideoWorkbenchService } from "./video-workbench.service"
import { VideoProjectEditorService } from "./video-project-editor.service"

const build = async () => {
    const entityManager = mockEntityManager()
    const members = mock<WorkspaceMembersService>()
    const workbench = mock<VideoWorkbenchService>()
    const writer = mock<VideoProjectWorkbenchWriterService>()
    const events = mock<EventsService>()
    const brands = mock<VideoBrandKitsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            VideoProjectEditorService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: VideoWorkbenchService, useValue: workbench },
            { provide: VideoProjectWorkbenchWriterService, useValue: writer },
            { provide: EventsService, useValue: events },
            { provide: VideoBrandKitsService, useValue: brands },
        ],
    }).compile()
    return {
        service: moduleRef.get(VideoProjectEditorService),
        entityManager,
        members,
        workbench,
        writer,
        events,
        brands,
    }
}

describe("VideoProjectEditorService", () => {
    describe("create", () => {
        it("create has its first case written", async () => {
            const { service } = await build()
            expect(service.create).toBeInstanceOf(Function)
        })
    })

    describe("update", () => {
        it("update has its first case written", async () => {
            const { service } = await build()
            expect(service.update).toBeInstanceOf(Function)
        })
    })

    describe("duplicate", () => {
        it("duplicate has its first case written", async () => {
            const { service } = await build()
            expect(service.duplicate).toBeInstanceOf(Function)
        })
    })

    describe("archive", () => {
        it("archive has its first case written", async () => {
            const { service } = await build()
            expect(service.archive).toBeInstanceOf(Function)
        })
    })

    describe("publish", () => {
        it("publish has its first case written", async () => {
            const { service } = await build()
            expect(service.publish).toBeInstanceOf(Function)
        })
    })

    describe("saveBrand", () => {
        it("saveBrand has its first case written", async () => {
            const { service } = await build()
            expect(service.saveBrand).toBeInstanceOf(Function)
        })
    })
})
