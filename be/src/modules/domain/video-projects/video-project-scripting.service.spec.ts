import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { FAIL_SCRIPT_PROJECT, FINISH_SCRIPT_PROJECT, START_SCRIPT_PROJECT } from "./persistence/video-scripting.sql"
import { VideoProjectScriptingService } from "./video-project-scripting.service"

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [VideoProjectScriptingService] }).compile()
    return moduleRef.get(VideoProjectScriptingService)
}

describe("VideoProjectScriptingService", () => {
    describe("start", () => {
        it("stores the operation metadata in the caller's transaction", async () => {
            const tx = mockEntityManager({ query: [START_SCRIPT_PROJECT, []] })
            const service = await build()

            await expect(service.start(tx, "workspace-1", "project-1", '{"attempts":1}')).resolves.toBeUndefined()

            expect(tx.query).toHaveBeenCalledWith(START_SCRIPT_PROJECT, ["workspace-1", "project-1", '{"attempts":1}'])
        })
    })

    describe("finish", () => {
        it("stores the scenes, the timing and the automatic title of the owning generation", async () => {
            const tx = mockEntityManager({ query: [FINISH_SCRIPT_PROJECT, []] })
            const service = await build()

            await expect(
                service.finish(tx, {
                    workspaceId: "workspace-1",
                    projectId: "project-1",
                    generationId: "generation-1",
                    script: "[]",
                    durationMs: 1200,
                    title: "Spring offer",
                    meta: "{}",
                }),
            ).resolves.toBeUndefined()

            expect(tx.query).toHaveBeenCalledWith(FINISH_SCRIPT_PROJECT, [
                "workspace-1",
                "project-1",
                "generation-1",
                "[]",
                1200,
                "Spring offer",
                "{}",
            ])
        })
    })

    describe("fail", () => {
        it("stores the stable failure code of the owning generation", async () => {
            const tx = mockEntityManager({ query: [FAIL_SCRIPT_PROJECT, []] })
            const service = await build()

            await expect(
                service.fail(tx, {
                    workspaceId: "workspace-1",
                    projectId: "project-1",
                    generationId: "generation-1",
                    code: "code:VIDEO_SCRIPT_FAILED",
                    meta: "{}",
                }),
            ).resolves.toBeUndefined()

            expect(tx.query).toHaveBeenCalledWith(FAIL_SCRIPT_PROJECT, [
                "workspace-1",
                "project-1",
                "generation-1",
                "code:VIDEO_SCRIPT_FAILED",
                "{}",
            ])
        })
    })
})
