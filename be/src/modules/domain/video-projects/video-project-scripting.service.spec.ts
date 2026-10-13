import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { VideoProjectScriptingService } from "./video-project-scripting.service"
import { FAIL_SCRIPT_PROJECT, FINISH_SCRIPT_PROJECT, START_SCRIPT_PROJECT } from "./persistence/video-scripting.sql"

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [VideoProjectScriptingService],
    }).compile()
    return { scripting: moduleRef.get(VideoProjectScriptingService), tx: mockEntityManager() }
}

describe("VideoProjectScriptingService", () => {
    it("stores the operation metadata with the queued generation", async () => {
        const { scripting, tx } = await build()

        await expect(scripting.start(tx, "ws-1", "proj-1", '{"generation_id":"gen-1"}')).resolves.toBeUndefined()

        expect(tx.query).toHaveBeenCalledWith(START_SCRIPT_PROJECT, ["ws-1", "proj-1", '{"generation_id":"gen-1"}'])
    })

    it("stores scenes only for the generation that owns the project", async () => {
        const { scripting, tx } = await build()
        const finish = {
            workspaceId: "ws-1",
            projectId: "proj-1",
            generationId: "gen-1",
            script: "[]",
            durationMs: 15000,
            title: "Launch",
            meta: "{}",
        }

        await expect(scripting.finish(tx, finish)).resolves.toBeUndefined()

        expect(tx.query).toHaveBeenCalledWith(FINISH_SCRIPT_PROJECT, [
            "ws-1",
            "proj-1",
            "gen-1",
            "[]",
            15000,
            "Launch",
            "{}",
        ])
    })

    it("stores a stable failure only for the owning generation", async () => {
        const { scripting, tx } = await build()

        await expect(
            scripting.fail(tx, {
                workspaceId: "ws-1",
                projectId: "proj-1",
                generationId: "gen-1",
                code: "SCRIPT_FAILED",
                meta: "{}",
            }),
        ).resolves.toBeUndefined()

        expect(tx.query).toHaveBeenCalledWith(FAIL_SCRIPT_PROJECT, ["ws-1", "proj-1", "gen-1", "SCRIPT_FAILED", "{}"])
    })
})
