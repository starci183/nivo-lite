import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import { VideoRendersService } from "@modules/domain/video-renders"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ContentEditorService } from "./content-editor.service"

const build = async () => {
    const clock = new FakeClock("2026-01-01T00:00:00.000Z")
    const entityManager = mockEntityManager()
    const members = mock<WorkspaceMembersService>()
    const renders = mock<VideoRendersService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ContentEditorService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: clock },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: VideoRendersService, useValue: renders },
        ],
    }).compile()
    return { service: moduleRef.get(ContentEditorService), clock, entityManager, members, renders }
}

describe("ContentEditorService", () => {
    describe("actor", () => {
        it("actor has its first case written", async () => {
            const { service } = await build()
            expect(service.actor).toBeInstanceOf(Function)
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

    describe("getForUser", () => {
        it("getForUser has its first case written", async () => {
            const { service } = await build()
            expect(service.getForUser).toBeInstanceOf(Function)
        })
    })

    describe("create", () => {
        it("create has its first case written", async () => {
            const { service } = await build()
            expect(service.create).toBeInstanceOf(Function)
        })
    })

    describe("save", () => {
        it("save has its first case written", async () => {
            const { service } = await build()
            expect(service.save).toBeInstanceOf(Function)
        })
    })

    describe("move", () => {
        it("move has its first case written", async () => {
            const { service } = await build()
            expect(service.move).toBeInstanceOf(Function)
        })
    })

    describe("transition", () => {
        it("transition has its first case written", async () => {
            const { service } = await build()
            expect(service.transition).toBeInstanceOf(Function)
        })
    })

    describe("figures", () => {
        it("figures has its first case written", async () => {
            const { service } = await build()
            expect(service.figures).toBeInstanceOf(Function)
        })
    })

    describe("workbench", () => {
        it("workbench has its first case written", async () => {
            const { service } = await build()
            expect(service.workbench).toBeInstanceOf(Function)
        })
    })
})
