import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { VideoRendersError, VideoRendersErrorCode } from "./errors/video-renders.error"
import type { RenderStatus } from "./video-renders.contracts"
import { VideoRenderStatusService } from "./video-render-status.service"
import { VideoRendersService } from "./video-renders.service"

const STATUS: RenderStatus = {
    id: "render-1",
    status: "running",
    progress: 40,
    stage: "scenes",
    outputPath: null,
    posterPath: null,
    durationMs: null,
    sizeBytes: null,
    errorCode: null,
}

const build = async () => {
    const members = mock<WorkspaceMembersService>()
    const renders = mock<VideoRendersService>()
    renders.getStatus.mockResolvedValue(STATUS)
    const moduleRef = await Test.createTestingModule({
        providers: [
            VideoRenderStatusService,
            { provide: WorkspaceMembersService, useValue: members },
            { provide: VideoRendersService, useValue: renders },
        ],
    }).compile()
    return { service: moduleRef.get(VideoRenderStatusService), members, renders }
}

describe("VideoRenderStatusService", () => {
    describe("forMember", () => {
        it("answers the render of the member's workspace", async () => {
            const { service, members, renders } = await build()

            await expect(
                service.forMember("person-1", { workspaceId: "workspace-1", id: "render-1" }),
            ).resolves.toEqual(STATUS)
            expect(members.require).toHaveBeenCalledWith("person-1", "workspace-1")
            expect(renders.getStatus).toHaveBeenCalledWith("workspace-1", "render-1")
        })

        it("reads nothing for someone outside the workspace", async () => {
            const { service, members, renders } = await build()
            const refusal = new VideoRendersError({ code: VideoRendersErrorCode.NotFound })
            members.require.mockRejectedValue(refusal)

            await expect(service.forMember("person-2", { workspaceId: "workspace-1", id: "render-1" })).rejects.toBe(
                refusal,
            )
            expect(renders.getStatus).not.toHaveBeenCalled()
        })
    })
})
