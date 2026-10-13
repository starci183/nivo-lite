import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { INSERT_PROJECT_VERSION } from "./persistence/video-project-versions.sql"
import { VideoProjectVersionsService } from "./video-project-versions.service"

describe("VideoProjectVersionsService", () => {
    describe("record", () => {
        it("writes the snapshot next to the render it started", async () => {
            const moduleRef = await Test.createTestingModule({ providers: [VideoProjectVersionsService] }).compile()
            const manager = mockEntityManager({ query: [INSERT_PROJECT_VERSION, []] })

            await moduleRef.get(VideoProjectVersionsService).record(manager, {
                projectId: "project-1",
                workspaceId: "workspace-1",
                version: 3,
                script: "[]",
                spec: '{"version":1}',
                renderId: "render-1",
                createdBy: "person-1",
            })

            expect(manager.query).toHaveBeenCalledWith(INSERT_PROJECT_VERSION, [
                "project-1",
                "workspace-1",
                3,
                "[]",
                '{"version":1}',
                "render-1",
                "person-1",
            ])
        })
    })
})
