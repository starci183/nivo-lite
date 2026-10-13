import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WORK_PERFORMER_REGISTRY } from "@modules/domain/decisions"
import type { WorkPerformerRegistry } from "@modules/domain/decisions"
import { VideoProjectWorkbenchWriterService } from "@modules/domain/video-projects"
import { VideoApprovalPerformerService } from "./video-approval-performer.service"

const build = async () => {
    const writer = mock<VideoProjectWorkbenchWriterService>()
    const registry = mock<WorkPerformerRegistry>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            VideoApprovalPerformerService,
            { provide: VideoProjectWorkbenchWriterService, useValue: writer },
            { provide: WORK_PERFORMER_REGISTRY, useValue: registry },
        ],
    }).compile()
    return { service: moduleRef.get(VideoApprovalPerformerService), writer, registry }
}

describe("VideoApprovalPerformerService", () => {
    describe("onModuleInit", () => {
        it("onModuleInit has its first case written", async () => {
            const { service } = await build()
            expect(service.onModuleInit).toBeInstanceOf(Function)
        })
    })

    describe("prepare", () => {
        it("prepare has its first case written", async () => {
            const { service } = await build()
            expect(service.prepare).toBeInstanceOf(Function)
        })
    })

    describe("perform", () => {
        it("perform has its first case written", async () => {
            const { service } = await build()
            expect(service.perform).toBeInstanceOf(Function)
        })
    })
})
