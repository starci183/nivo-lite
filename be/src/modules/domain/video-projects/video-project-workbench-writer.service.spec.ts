import { Test } from "@nestjs/testing"
import { FakeClock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { VideoProjectEntity } from "./persistence/entities"
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

/** A manager double whose every query builder is one fake that answers the given terminals and records the chain. */
const managerAnswering = (answers: QueryBuilderAnswers, em: MockEntityManager = mockEntityManager()) => {
    const fake = fakeQueryBuilder(answers)
    em.createQueryBuilder.mockReturnValue(fake.builder as never)
    return { em, fake }
}

/** The answer of an `UPDATE ... RETURNING id` or an `INSERT ... RETURNING id`. */
const returned = (rows: ReadonlyArray<{ readonly id: string }>): QueryBuilderAnswers => ({ execute: { raw: rows } })

const ONE = [{ id: "project-1" }]

const SCRIPTED_STATUS =
    "CASE WHEN CAST(:script AS jsonb) IS NOT NULL AND status IN ('ready', 'approved', 'published') THEN 'draft' ELSE status END"

const IDLE = "status NOT IN ('scripting', 'rendering')"

describe("VideoProjectWorkbenchWriterService > create", () => {
    it("saves a typed title and answers the new project id", async () => {
        const { em: tx, fake } = managerAnswering(returned(ONE))
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

        expect(tx.createQueryBuilder).toHaveBeenCalledWith(VideoProjectEntity, "v")

        expect(fake.callsOf("insert")).toEqual([[]])
        expect(fake.callsOf("values")).toEqual([
            [
                {
                    workspaceId: "workspace-1",
                    title: "Spring offer",
                    goal: "offer",
                    aspect: "9:16",
                    targetSeconds: 30,
                    inputs: { notes: "fresh bread" },
                    scriptMeta: {},
                    createdBy: "person-1",
                },
            ],
        ])
        expect(fake.callsOf("returning")).toEqual([["id"]])
    })

    it("names an untitled project after its goal and today, and marks the title automatic", async () => {
        const { em: tx, fake } = managerAnswering(returned([{ id: "project-2" }]))
        const writer = await build()

        await writer.create(tx, "workspace-1", "person-1", { goal: "hiring", aspect: "1:1", targetSeconds: 15 })

        expect(fake.callsOf("values")[0]?.[0]).toMatchObject({
            title: "hiring - 2026-10-13",
            scriptMeta: { auto_title: true },
        })
    })

    it("answers null when nothing was saved", async () => {
        const { em: tx } = managerAnswering(returned([]))
        const writer = await build()

        await expect(
            writer.create(tx, "workspace-1", "person-1", { goal: "offer", aspect: "9:16", targetSeconds: 30 }),
        ).resolves.toBeNull()
    })
})

describe("VideoProjectWorkbenchWriterService > update", () => {
    it("serializes the changed inputs and scenes, guards an idle project in one statement and reports the change", async () => {
        const { em, fake } = managerAnswering(returned(ONE))
        const writer = await build(em)

        await expect(
            writer.update("workspace-1", "project-1", { title: "New", inputs: { notes: "x" }, script: [] }),
        ).resolves.toBe(true)

        expect(em.createQueryBuilder).toHaveBeenCalledWith(VideoProjectEntity, "v")

        expect(fake.callsOf("update")).toEqual([[]])
        expect(fake.callsOf("set").map(([set]) => evaluatedValues(set))).toEqual([
            {
                title: "COALESCE(NULLIF(CAST(:title AS text), ''), title)",
                goal: "COALESCE(CAST(:goal AS text), goal)",
                aspect: "COALESCE(CAST(:aspect AS text), aspect)",
                targetSeconds: "COALESCE(CAST(:targetSeconds AS integer), target_seconds)",
                inputs: "COALESCE(CAST(:inputs AS jsonb), inputs)",
                script: "COALESCE(CAST(:script AS jsonb), script)",
                status: SCRIPTED_STATUS,
                approvedAt: "CASE WHEN CAST(:script AS jsonb) IS NOT NULL THEN NULL ELSE approved_at END",
                approvedByName: "CASE WHEN CAST(:script AS jsonb) IS NOT NULL THEN NULL ELSE approved_by_name END",
                publishedAt: "CASE WHEN CAST(:script AS jsonb) IS NOT NULL THEN NULL ELSE published_at END",
            },
        ])
        expect(fake.callsOf("where")).toEqual([
            [
                `workspace_id = :workspaceId AND id = :projectId AND ${IDLE}`,
                { workspaceId: "workspace-1", projectId: "project-1" },
            ],
        ])
        expect(fake.callsOf("setParameters")).toEqual([
            [{ title: "New", goal: null, aspect: null, targetSeconds: null, inputs: '{"notes":"x"}', script: "[]" }],
        ])
        expect(fake.callsOf("returning")).toEqual([["id"]])
    })

    it("reports a busy project that did not change", async () => {
        const { em, fake } = managerAnswering(returned([]))
        const writer = await build(em)

        await expect(writer.update("workspace-1", "project-1", {})).resolves.toBe(false)
        expect(fake.callsOf("setParameters")).toEqual([
            [{ title: null, goal: null, aspect: null, targetSeconds: null, inputs: null, script: null }],
        ])
    })
})

describe("VideoProjectWorkbenchWriterService > duplicate", () => {
    it("answers the copy's id, or null when the source is missing", async () => {
        const source = Object.assign(new VideoProjectEntity(), {
            id: "project-1",
            workspaceId: "workspace-1",
            title: "Spring offer",
            goal: "offer",
            aspect: "9:16",
            targetSeconds: 30,
            inputs: { notes: "x" },
            script: [{ caption: "A" }],
        })
        const copied = managerAnswering(
            returned([{ id: "project-2" }]),
            mockEntityManager({ findOne: [VideoProjectEntity, source] }),
        )
        const missing = managerAnswering(returned([]), mockEntityManager({ findOne: [VideoProjectEntity, null] }))
        const writer = await build()

        await expect(writer.duplicate(copied.em, "workspace-1", "project-1", "person-1")).resolves.toBe("project-2")
        await expect(writer.duplicate(missing.em, "workspace-1", "project-1", "person-1")).resolves.toBeNull()
        expect(copied.em.findOne).toHaveBeenCalledWith(VideoProjectEntity, {
            where: { workspaceId: "workspace-1", id: "project-1" },
            lock: { mode: "pessimistic_read" },
        })
        expect(copied.fake.callsOf("values")).toEqual([
            [
                {
                    workspaceId: "workspace-1",
                    title: "Spring offer (copy)",
                    goal: "offer",
                    aspect: "9:16",
                    targetSeconds: 30,
                    inputs: { notes: "x" },
                    script: [{ caption: "A" }],
                    sourceProjectId: "project-1",
                    createdBy: "person-1",
                },
            ],
        ])
        expect(missing.fake.callsOf("values")).toEqual([])
    })

    it("answers null when the copy returned no id", async () => {
        const source = Object.assign(new VideoProjectEntity(), {
            id: "project-1",
            workspaceId: "workspace-1",
            title: "T",
        })
        const { em } = managerAnswering(returned([]), mockEntityManager({ findOne: [VideoProjectEntity, source] }))

        await expect((await build()).duplicate(em, "workspace-1", "project-1", "person-1")).resolves.toBeNull()
    })

    it("cuts the title of the copy at 120 characters", async () => {
        const source = Object.assign(new VideoProjectEntity(), {
            id: "project-1",
            workspaceId: "workspace-1",
            title: "x".repeat(120),
        })
        const { em, fake } = managerAnswering(
            returned([{ id: "project-2" }]),
            mockEntityManager({ findOne: [VideoProjectEntity, source] }),
        )
        const writer = await build()

        await writer.duplicate(em, "workspace-1", "project-1", "person-1")

        expect(fake.callsOf("values")[0]?.[0]).toMatchObject({ title: "x".repeat(120) })
    })
})

describe("VideoProjectWorkbenchWriterService > archive", () => {
    it("reports whether the idle project changed", async () => {
        const changed = managerAnswering(returned(ONE))
        const busy = managerAnswering(returned([]))

        await expect((await build(changed.em)).archive("workspace-1", "project-1", true)).resolves.toBe(true)
        await expect((await build(busy.em)).archive("workspace-1", "project-1", false)).resolves.toBe(false)
        expect(changed.fake.callsOf("where")).toEqual([
            [
                `workspace_id = :workspaceId AND id = :projectId AND ${IDLE}`,
                { workspaceId: "workspace-1", projectId: "project-1" },
            ],
        ])
        expect(changed.fake.callsOf("setParameter")).toEqual([["archived", true]])
        const set = changed.fake.callsOf("set")[0]?.[0] as { status: () => string }
        expect(set.status()).toBe(
            "CASE WHEN CAST(:archived AS boolean) THEN 'archived' WHEN render_id IS NULL THEN 'draft' ELSE 'ready' END",
        )
    })
})

describe("VideoProjectWorkbenchWriterService > publish", () => {
    it("reports whether an approved project was published", async () => {
        const approved = managerAnswering(returned(ONE))
        const draft = managerAnswering(returned([]))
        const writer = await build()

        await expect(writer.publish(approved.em, "workspace-1", "project-1")).resolves.toBe(true)
        await expect(writer.publish(draft.em, "workspace-1", "project-1")).resolves.toBe(false)
        expect(approved.fake.callsOf("set").map(([set]) => evaluatedValues(set))).toEqual([
            { status: "published", publishedAt: "now()" },
        ])
        expect(approved.fake.callsOf("where")).toEqual([
            [
                "workspace_id = :workspaceId AND id = :projectId AND status = 'approved'",
                { workspaceId: "workspace-1", projectId: "project-1" },
            ],
        ])
    })
})

describe("VideoProjectWorkbenchWriterService > approve", () => {
    it("records the approver of the selected render once a done render backs it", async () => {
        const { em, fake } = managerAnswering(returned(ONE))
        const writer = await build(em)

        await expect(writer.approve("workspace-1", "project-1", "render-1", "Lan")).resolves.toBe(true)
        expect(fake.callsOf("set").map(([set]) => evaluatedValues(set))).toEqual([
            { status: "approved", approvedAt: "now()", approvedByName: "Lan" },
        ])
        expect(fake.callsOf("where")).toEqual([
            [
                "workspace_id = :workspaceId AND id = :projectId AND render_id = :renderId AND status = 'ready'",
                { workspaceId: "workspace-1", projectId: "project-1", renderId: "render-1" },
            ],
        ])
        expect(fake.callsOf("andWhere")[0]?.[0]).toContain("r.status = 'done'")
    })

    it("reports a render that is not the finished one", async () => {
        const { em } = managerAnswering(returned([]))
        const writer = await build(em)

        await expect(writer.approve("workspace-1", "project-1", "render-0", "Lan")).resolves.toBe(false)
    })
})

describe("VideoProjectWorkbenchWriterService > createDelegated", () => {
    it("saves the delegated script with no creator and answers the new project id", async () => {
        const { em: tx, fake } = managerAnswering(returned(ONE))
        const writer = await build()
        const draft = { title: "Weekend", goal: "offer", aspect: "9:16", targetSeconds: 15, script: [{ caption: "A" }] }

        await expect(writer.createDelegated(tx, "workspace-1", draft)).resolves.toBe("project-1")

        expect(fake.callsOf("values")).toEqual([
            [
                {
                    workspaceId: "workspace-1",
                    title: "Weekend",
                    goal: "offer",
                    aspect: "9:16",
                    targetSeconds: 15,
                    script: [{ caption: "A" }],
                    inputs: {},
                    scriptMeta: { delegated: true },
                    createdBy: null,
                },
            ],
        ])
    })

    it("answers null when nothing was written", async () => {
        const { em: tx } = managerAnswering(returned([]))
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
