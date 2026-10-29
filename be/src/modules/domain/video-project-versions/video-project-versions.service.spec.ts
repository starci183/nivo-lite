import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { VideoRendersErrorCode } from "@modules/domain/video-renders"
import { VideoProjectVersionEntity } from "./persistence/entities"
import { VideoProjectVersionsService } from "./video-project-versions.service"

describe("VideoProjectVersionsService", () => {
    describe("record", () => {
        it("writes the snapshot next to the render it started", async () => {
            const moduleRef = await Test.createTestingModule({ providers: [VideoProjectVersionsService] }).compile()
            const manager = mockEntityManager({ save: [VideoProjectVersionEntity, new VideoProjectVersionEntity()] })

            await expect(
                moduleRef.get(VideoProjectVersionsService).record(manager, {
                    projectId: "project-1",
                    workspaceId: "workspace-1",
                    version: 3,
                    script: "[]",
                    spec: '{"version":1}',
                    renderId: "render-1",
                    createdBy: "person-1",
                }),
            ).resolves.toBeUndefined()

            expect(manager.save).toHaveBeenCalledWith(VideoProjectVersionEntity, {
                projectId: "project-1",
                workspaceId: "workspace-1",
                version: 3,
                script: [],
                spec: { version: 1 },
                renderId: "render-1",
                createdBy: "person-1",
            })
        })

        it.each([
            ["script", "{not json", "{}"],
            ["spec", "[]", ""],
        ])("refuses a snapshot whose %s is not JSON and writes nothing", async (_part, script, spec) => {
            const moduleRef = await Test.createTestingModule({ providers: [VideoProjectVersionsService] }).compile()
            const manager = mockEntityManager()

            await expect(
                moduleRef.get(VideoProjectVersionsService).record(manager, {
                    projectId: "project-1",
                    workspaceId: "workspace-1",
                    version: 3,
                    script,
                    spec,
                    renderId: "render-1",
                    createdBy: "person-1",
                }),
            ).rejects.toMatchObject({ code: VideoRendersErrorCode.JsonUnreadable })
            expect(manager.save).not.toHaveBeenCalled()
        })
    })
})
