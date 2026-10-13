import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WorkEngineService } from "@modules/domain/decisions"
import { VideoWorkbenchService } from "./video-workbench.service"
import { VideoApprovalService } from "./video-approval.service"

const build = async () => {
    const workbench = mock<VideoWorkbenchService>()
    const engine = mock<WorkEngineService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            VideoApprovalService,
            { provide: VideoWorkbenchService, useValue: workbench },
            { provide: WorkEngineService, useValue: engine },
        ],
    }).compile()
    return { service: moduleRef.get(VideoApprovalService), workbench, engine }
}

describe("VideoApprovalService", () => {
    describe("approve", () => {
        it("approve has its first case written", async () => {
            const { service } = await build()
            expect(service.approve).toBeInstanceOf(Function)
        })
    })
})
