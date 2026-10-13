import { Test } from "@nestjs/testing"
import { FakeClock, mockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { VideoProjectWorkbenchWriterService } from "./video-project-workbench-writer.service"
import {
    APPROVE_VIDEO_PROJECT,
    ARCHIVE_WORKBENCH_PROJECT,
    CREATE_WORKBENCH_PROJECT,
    UPDATE_WORKBENCH_PROJECT,
} from "./persistence/video-workbench.sql"

const NOW = "2026-10-12T03:00:00.000Z"

const build = async (query: ReadonlyArray<readonly [string, ReadonlyArray<{ id: string }>]>) => {
    const em = mockEntityManager({ query })
    const moduleRef = await Test.createTestingModule({
        providers: [
            VideoProjectWorkbenchWriterService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
        ],
    }).compile()
    return { writer: moduleRef.get(VideoProjectWorkbenchWriterService), em }
}

describe("VideoProjectWorkbenchWriterService", () => {
    it("creates a titled project and answers its id", async () => {
        const { writer, em } = await build([[CREATE_WORKBENCH_PROJECT, [{ id: "proj-1" }]]])

        await expect(
            writer.create(em, "ws-1", "user-1", {
                title: "Launch",
                goal: "Grow",
                aspect: "9:16",
                targetSeconds: 15,
                inputs: { brief: "tea" },
            }),
        ).resolves.toBe("proj-1")

        expect(em.query).toHaveBeenCalledWith(CREATE_WORKBENCH_PROJECT, [
            "ws-1",
            "Launch",
            "Grow",
            "9:16",
            15,
            '{"brief":"tea"}',
            "{}",
            "user-1",
        ])
    })

    it("titles an untitled project from the goal and the clock day", async () => {
        const { writer, em } = await build([[CREATE_WORKBENCH_PROJECT, [{ id: "proj-2" }]]])

        await expect(
            writer.create(em, "ws-1", "user-1", { goal: "Grow", aspect: "9:16", targetSeconds: 15 }),
        ).resolves.toBe("proj-2")

        expect(em.query).toHaveBeenCalledWith(CREATE_WORKBENCH_PROJECT, [
            "ws-1",
            "Grow - 2026-10-12",
            "Grow",
            "9:16",
            15,
            undefined,
            '{"auto_title":true}',
            "user-1",
        ])
    })

    it("answers false when an update matches no idle project", async () => {
        const { writer } = await build([[UPDATE_WORKBENCH_PROJECT, []]])

        await expect(writer.update("ws-1", "proj-1", { title: "Later" })).resolves.toBe(false)
    })

    it("archives an idle project", async () => {
        const { writer, em } = await build([[ARCHIVE_WORKBENCH_PROJECT, [{ id: "proj-1" }]]])

        await expect(writer.archive("ws-1", "proj-1", true)).resolves.toBe(true)

        expect(em.query).toHaveBeenCalledWith(ARCHIVE_WORKBENCH_PROJECT, ["ws-1", "proj-1", true])
    })

    it("records an approval only when the render row is updated", async () => {
        const { writer, em } = await build([[APPROVE_VIDEO_PROJECT, [{ id: "proj-1" }]]])

        await expect(writer.approve("ws-1", "proj-1", "render-1", "Lan")).resolves.toBe(true)

        expect(em.query).toHaveBeenCalledWith(APPROVE_VIDEO_PROJECT, ["ws-1", "proj-1", "render-1", "Lan"])
    })
})
