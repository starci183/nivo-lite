import { Test } from "@nestjs/testing"
import { FakeClock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import {
    APPROVE_VIDEO_PROJECT,
    ARCHIVE_WORKBENCH_PROJECT,
    CREATE_DELEGATED_PROJECT,
    CREATE_WORKBENCH_PROJECT,
    DUPLICATE_WORKBENCH_PROJECT,
    PUBLISH_WORKBENCH_PROJECT,
    UPDATE_WORKBENCH_PROJECT,
} from "./persistence/video-workbench.sql"
import { VideoProjectWorkbenchWriterService } from "./video-project-workbench-writer.service"

const build = async (em: MockEntityManager = mockEntityManager()) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            VideoProjectWorkbenchWriterService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock("2026-10-13T09:00:00.000Z") },
        ],
    }).compile()
    return moduleRef.get(VideoProjectWorkbenchWriterService)
}

describe("VideoProjectWorkbenchWriterService > create", () => {
    it("saves a typed title and answers the new project id", async () => {
        const tx = mockEntityManager({ query: [CREATE_WORKBENCH_PROJECT, [{ id: "project-1" }]] })
        const writer = await build()

        await expect(
            writer.create(tx, "workspace-1", "person-1", {
                title: "  Spring offer ",
                goal: "offer",
                aspect: "9:16",
                targetSeconds: 30,
                inputs: { notes: "fresh bread" },
            }),
        ).resolves.toBe("project-1")

        expect(tx.query).toHaveBeenCalledWith(CREATE_WORKBENCH_PROJECT, [
            "workspace-1",
            "Spring offer",
            "offer",
            "9:16",
            30,
            '{"notes":"fresh bread"}',
            "{}",
            "person-1",
        ])
    })

    it("names an untitled project after its goal and today, and marks the title automatic", async () => {
        const tx = mockEntityManager({ query: [CREATE_WORKBENCH_PROJECT, [{ id: "project-2" }]] })
        const writer = await build()

        await writer.create(tx, "workspace-1", "person-1", { goal: "hiring", aspect: "1:1", targetSeconds: 15 })

        const params = tx.query.mock.calls[0]?.[1]
        expect(params?.[1]).toBe("hiring - 2026-10-13")
        expect(params?.[6]).toBe('{"auto_title":true}')
    })

    it("answers null when nothing was saved", async () => {
        const tx = mockEntityManager({ query: [CREATE_WORKBENCH_PROJECT, []] })
        const writer = await build()

        await expect(
            writer.create(tx, "workspace-1", "person-1", { goal: "offer", aspect: "9:16", targetSeconds: 30 }),
        ).resolves.toBeNull()
    })
})

describe("VideoProjectWorkbenchWriterService > update", () => {
    it("serializes the changed inputs and scenes and reports the change", async () => {
        const em = mockEntityManager({ query: [UPDATE_WORKBENCH_PROJECT, [{ id: "project-1" }]] })
        const writer = await build(em)

        await expect(
            writer.update("workspace-1", "project-1", { title: "New", inputs: { notes: "x" }, script: [] }),
        ).resolves.toBe(true)

        expect(em.query).toHaveBeenCalledWith(UPDATE_WORKBENCH_PROJECT, [
            "workspace-1",
            "project-1",
            "New",
            null,
            null,
            null,
            '{"notes":"x"}',
            "[]",
        ])
    })

    it("reports a busy project that did not change", async () => {
        const em = mockEntityManager({ query: [UPDATE_WORKBENCH_PROJECT, []] })
        const writer = await build(em)

        await expect(writer.update("workspace-1", "project-1", {})).resolves.toBe(false)
        expect(em.query.mock.calls[0]?.[1]).toEqual(["workspace-1", "project-1", null, null, null, null, null, null])
    })
})

describe("VideoProjectWorkbenchWriterService > duplicate", () => {
    it("answers the copy's id, or null when the source is missing", async () => {
        const copied = mockEntityManager({ query: [DUPLICATE_WORKBENCH_PROJECT, [{ id: "project-2" }]] })
        const missing = mockEntityManager({ query: [DUPLICATE_WORKBENCH_PROJECT, []] })
        const writer = await build()

        await expect(writer.duplicate(copied, "workspace-1", "project-1", "person-1")).resolves.toBe("project-2")
        await expect(writer.duplicate(missing, "workspace-1", "project-1", "person-1")).resolves.toBeNull()
        expect(copied.query).toHaveBeenCalledWith(DUPLICATE_WORKBENCH_PROJECT, ["workspace-1", "project-1", "person-1"])
    })
})

describe("VideoProjectWorkbenchWriterService > archive", () => {
    it("reports whether the idle project changed", async () => {
        const changed = mockEntityManager({ query: [ARCHIVE_WORKBENCH_PROJECT, [{ id: "project-1" }]] })
        const busy = mockEntityManager({ query: [ARCHIVE_WORKBENCH_PROJECT, []] })

        await expect((await build(changed)).archive("workspace-1", "project-1", true)).resolves.toBe(true)
        await expect((await build(busy)).archive("workspace-1", "project-1", false)).resolves.toBe(false)
        expect(changed.query).toHaveBeenCalledWith(ARCHIVE_WORKBENCH_PROJECT, ["workspace-1", "project-1", true])
    })
})

describe("VideoProjectWorkbenchWriterService > publish", () => {
    it("reports whether an approved project was published", async () => {
        const approved = mockEntityManager({ query: [PUBLISH_WORKBENCH_PROJECT, [{ id: "project-1" }]] })
        const draft = mockEntityManager({ query: [PUBLISH_WORKBENCH_PROJECT, []] })
        const writer = await build()

        await expect(writer.publish(approved, "workspace-1", "project-1")).resolves.toBe(true)
        await expect(writer.publish(draft, "workspace-1", "project-1")).resolves.toBe(false)
    })
})

describe("VideoProjectWorkbenchWriterService > approve", () => {
    it("records the approver of the selected render", async () => {
        const em = mockEntityManager({ query: [APPROVE_VIDEO_PROJECT, [{ id: "project-1" }]] })
        const writer = await build(em)

        await expect(writer.approve("workspace-1", "project-1", "render-1", "Lan")).resolves.toBe(true)
        expect(em.query).toHaveBeenCalledWith(APPROVE_VIDEO_PROJECT, ["workspace-1", "project-1", "render-1", "Lan"])
    })

    it("reports a render that is not the finished one", async () => {
        const em = mockEntityManager({ query: [APPROVE_VIDEO_PROJECT, []] })
        const writer = await build(em)

        await expect(writer.approve("workspace-1", "project-1", "render-0", "Lan")).resolves.toBe(false)
    })
})

describe("VideoProjectWorkbenchWriterService > createDelegated", () => {
    it("saves the delegated script with no creator and answers the new project id", async () => {
        const tx = mockEntityManager({ query: [CREATE_DELEGATED_PROJECT, [{ id: "project-1" }]] })
        const writer = await build()
        const draft = { title: "Weekend", goal: "offer", aspect: "9:16", targetSeconds: 15, script: [{ caption: "A" }] }

        await expect(writer.createDelegated(tx, "workspace-1", draft)).resolves.toBe("project-1")

        expect(tx.query).toHaveBeenCalledWith(CREATE_DELEGATED_PROJECT, [
            "workspace-1",
            "Weekend",
            "offer",
            "9:16",
            15,
            '[{"caption":"A"}]',
        ])
    })

    it("answers null when nothing was written", async () => {
        const tx = mockEntityManager({ query: [CREATE_DELEGATED_PROJECT, []] })
        const writer = await build()

        await expect(
            writer.createDelegated(tx, "workspace-1", {
                title: "W",
                goal: "offer",
                aspect: "9:16",
                targetSeconds: 15,
                script: [],
            }),
        ).resolves.toBeNull()
    })
})
