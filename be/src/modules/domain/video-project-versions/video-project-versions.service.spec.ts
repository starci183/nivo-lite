import { Test } from "@nestjs/testing"
import { fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import { INSERT_PROJECT_VERSION } from "./persistence/video-project-versions.sql"
import { VideoProjectVersionsService } from "./video-project-versions.service"

describe("VideoProjectVersionsService", () => {
    describe("record", () => {
        it("writes the snapshot next to the render it started", async () => {
            const moduleRef = await Test.createTestingModule({ providers: [VideoProjectVersionsService] }).compile()
            const transaction = fakeTransaction(mockEntityManager({ query: [INSERT_PROJECT_VERSION, []] }))

            await transaction.em.transaction((manager) =>
                moduleRef.get(VideoProjectVersionsService).record(manager, {
                    projectId: "project-1",
                    workspaceId: "workspace-1",
                    version: 3,
                    script: "[]",
                    spec: '{"version":1}',
                    renderId: "render-1",
                    createdBy: "person-1",
                }),
            )

            expect(transaction.outcomes).toEqual(["commit"])
            expect(transaction.committedWrites).toEqual([
                {
                    method: "query",
                    args: [
                        INSERT_PROJECT_VERSION,
                        ["project-1", "workspace-1", 3, "[]", '{"version":1}', "render-1", "person-1"],
                    ],
                },
            ])
        })
    })
})
