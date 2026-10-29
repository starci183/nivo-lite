import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { writeExpressionOf } from "@tests/fixtures/builders/write-expression.builder"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { VideoProjectEntity } from "./persistence/entities"
import { VideoProjectsService } from "./video-projects.service"

/** The any-function matcher, typed `unknown` so it flows into any slot. */
const anyFunction = (): unknown => expect.any(Function)

const build = async (entityManager: MockEntityManager = mockEntityManager()) => {
    const moduleRef = await Test.createTestingModule({
        providers: [VideoProjectsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(VideoProjectsService)
}

/** A manager double whose only query builder answers the given terminals and records the chain. */
const managerAnswering = (answers: QueryBuilderAnswers) => {
    const manager = mockEntityManager()
    const fake = fakeQueryBuilder(answers)
    manager.createQueryBuilder.mockReturnValue(fake.builder)
    return { manager, fake }
}

const stored = (over: Partial<VideoProjectEntity> = {}) =>
    Object.assign(new VideoProjectEntity(), {
        id: "project-1",
        workspaceId: "workspace-1",
        title: "Spring offer",
        aspect: "9:16",
        status: "draft",
        script: [{ caption: "Hello" }],
        version: 3,
        renderId: "render-1",
        ...over,
    })

describe("VideoProjectsService > lockForRender", () => {
    it("answers the project locked in the caller's transaction", async () => {
        const manager = mockEntityManager({ findOne: [VideoProjectEntity, stored()] })
        const projects = await build()

        await expect(projects.lockForRender(manager, "project-1")).resolves.toEqual({
            id: "project-1",
            workspaceId: "workspace-1",
            aspect: "9:16",
            status: "draft",
            script: [{ caption: "Hello" }],
            version: 3,
            renderId: "render-1",
        })
        expect(manager.findOne).toHaveBeenCalledWith(VideoProjectEntity, {
            where: { id: "project-1" },
            lock: { mode: "pessimistic_write" },
        })
    })

    it("answers nothing when the project does not exist", async () => {
        const manager = mockEntityManager({ findOne: [VideoProjectEntity, null] })
        const projects = await build()

        await expect(projects.lockForRender(manager, "project-1")).resolves.toBeNull()
    })
})

describe("VideoProjectsService > readForScript", () => {
    it.each([true, false])("reads the project of the workspace for a script, locked: %s", async (lock) => {
        const row = { id: "project-1", title: "Spring offer", render_id: null }
        const { manager, fake } = managerAnswering({ getRawOne: row })
        const projects = await build()

        await expect(projects.readForScript(manager, "workspace-1", "project-1", lock)).resolves.toBe(row)

        expect(manager.createQueryBuilder).toHaveBeenCalledWith(VideoProjectEntity, "p")
        expect(fake.callsOf("select")).toEqual([["p.id", "id"]])
        expect(fake.callsOf("addSelect").map(([expression]) => expression)).toEqual([
            "p.title",
            "p.goal",
            "p.aspect",
            "p.target_seconds",
            "p.status",
            "p.inputs",
            "p.script_meta",
            "p.updated_at",
            "p.render_id",
        ])
        expect(fake.callsOf("where")).toEqual([
            [
                "p.workspace_id = :workspaceId AND p.id = :projectId",
                { workspaceId: "workspace-1", projectId: "project-1" },
            ],
        ])
        expect(fake.callsOf("setLock")).toEqual(lock ? [["pessimistic_write", undefined, ["p"]]] : [])
    })
})

describe("VideoProjectsService > listForWorkbench", () => {
    it("lists the newest projects of the workspace, bounded", async () => {
        const { manager, fake } = managerAnswering({ getRawMany: [{ id: "project-1" }] })
        const projects = await build(manager)

        await expect(projects.listForWorkbench("workspace-1", "project-1", true)).resolves.toEqual([
            { id: "project-1" },
        ])

        expect(manager.createQueryBuilder).toHaveBeenCalledWith(VideoProjectEntity, "p")
        expect(fake.callsOf("select")).toEqual([["p.*"]])
        expect(fake.callsOf("where")).toEqual([
            [
                "p.workspace_id = :workspaceId AND (:projectId::uuid IS NULL OR p.id = :projectId)",
                { workspaceId: "workspace-1", projectId: "project-1" },
            ],
        ])
        expect(fake.callsOf("andWhere")).toEqual([
            ["(:includeArchived::boolean OR p.status <> 'archived')", { includeArchived: true }],
        ])
        expect(fake.callsOf("orderBy")).toEqual([["p.updatedAt", "DESC"]])
        expect(fake.callsOf("limit")).toEqual([[60]])
    })
})

describe("VideoProjectsService > countsOf", () => {
    it("counts the projects by state", async () => {
        const counts = { rendering: 1, scripting: 2, readyToPublish: 3, approved: 1, published30: 4 }
        const { manager, fake } = managerAnswering({ getRawOne: counts })
        const projects = await build(manager)

        await expect(projects.countsOf("workspace-1")).resolves.toBe(counts)

        expect(fake.callsOf("select")).toEqual([
            ["count(*) FILTER (WHERE p.status = 'rendering')::int", "rendering"],
        ])
        expect(fake.callsOf("addSelect").map(([, alias]) => alias)).toEqual([
            "scripting",
            "readyToPublish",
            "approved",
            "published30",
        ])
        expect(fake.callsOf("where")).toEqual([["p.workspace_id = :workspaceId", { workspaceId: "workspace-1" }]])
    })
})


describe("VideoProjectsService > titlesOfRenders", () => {
    it("titles each render by the newest project that holds it", async () => {
        const { manager, fake } = managerAnswering({
            getRawMany: [
                { title: "Newest", render_id: "render-2", render_ids: ["render-1", "render-2"] },
                { title: "Older", render_id: "render-1", render_ids: ["render-0", "render-1"] },
                { title: "Unrelated", render_id: null, render_ids: ["render-9"] },
            ],
        })
        const projects = await build(manager)

        await expect(
            projects.titlesOfRenders("workspace-1", ["render-1", "render-2", "render-1"]),
        ).resolves.toEqual([
            { renderId: "render-2", title: "Newest" },
            { renderId: "render-1", title: "Newest" },
        ])

        expect(fake.callsOf("where")).toEqual([["p.workspace_id = :workspaceId", { workspaceId: "workspace-1" }]])
        expect(fake.callsOf("andWhere")).toEqual([
            [
                "(p.render_id = ANY(:ids::uuid[]) OR p.render_ids && :ids::uuid[])",
                { ids: ["render-1", "render-2"] },
            ],
        ])
        expect(fake.callsOf("orderBy")).toEqual([["p.updated_at", "DESC"]])
        expect(fake.callsOf("limit")).toEqual([[500]])
    })

    it("asks nothing for no renders", async () => {
        const manager = mockEntityManager()
        const projects = await build(manager)

        await expect(projects.titlesOfRenders("workspace-1", [])).resolves.toEqual([])
        expect(manager.createQueryBuilder).not.toHaveBeenCalled()
    })
})

describe("VideoProjectsService > cardFactsOf", () => {
    it("answers what a delegation card shows of a project of the workspace, or null", async () => {
        const em = mockEntityManager({
            findOne: [
                [VideoProjectEntity, stored()],
                [VideoProjectEntity, null],
            ],
        })
        const projects = await build(em)

        await expect(projects.cardFactsOf("workspace-1", "project-1")).resolves.toEqual({
            title: "Spring offer",
            aspect: "9:16",
            script: [{ caption: "Hello" }],
        })
        await expect(projects.cardFactsOf("workspace-1", "missing")).resolves.toBeNull()
        expect(em.findOne).toHaveBeenCalledWith(VideoProjectEntity, {
            select: { title: true, aspect: true, script: true },
            where: { id: "project-1", workspaceId: "workspace-1" },
        })
    })
})

describe("VideoProjectsService > startRender", () => {
    it("points the project at its new render, opens its next version and drops an earlier approval", async () => {
        const { manager, fake } = managerAnswering({ execute: { raw: [] } })
        const projects = await build()

        await projects.startRender(manager, { projectId: "project-1", renderId: "render-1", spec: '{"version":1}' })

        expect(manager.createQueryBuilder).toHaveBeenCalledWith(VideoProjectEntity, "v")

        expect(fake.callsOf("update")).toEqual([[]])
        expect(fake.callsOf("set")).toEqual([
            [
                {
                    status: "rendering",
                    renderId: "render-1",
                    renderIds: anyFunction(),
                    currentSpec: anyFunction(),
                    version: anyFunction(),
                    lastError: null,
                    approvedAt: null,
                    approvedByName: null,
                    publishedAt: null,
                },
            ],
        ])
        expect(fake.callsOf("where")).toEqual([["id = :projectId", { projectId: "project-1" }]])
        expect(fake.callsOf("setParameters")).toEqual([[{ appendedRenderId: "render-1", spec: '{"version":1}' }]])
        const set = fake.callsOf("set")[0]?.[0]
        expect(writeExpressionOf(set, "renderIds")).toBe("array_append(render_ids, CAST(:appendedRenderId AS uuid))")
        expect(writeExpressionOf(set, "currentSpec")).toBe("CAST(:spec AS jsonb)")
        expect(writeExpressionOf(set, "version")).toBe("version + 1")
    })
})

describe("VideoProjectsService > markReady and markDraft", () => {
    it("makes the project of a finished render ready", async () => {
        const manager = mockEntityManager({
            update: [VideoProjectEntity, { affected: 1, raw: [], generatedMaps: [] }],
        })
        const projects = await build()

        await projects.markReady(manager, "render-1")

        expect(manager.update).toHaveBeenCalledWith(
            VideoProjectEntity,
            { renderId: "render-1", status: "rendering" },
            { status: "ready", lastError: null },
        )
    })

    it("sends the project of a failed render back to draft with the reason", async () => {
        const manager = mockEntityManager({
            update: [VideoProjectEntity, { affected: 1, raw: [], generatedMaps: [] }],
        })
        const projects = await build()

        await projects.markDraft(manager, "render-1", "It failed")

        expect(manager.update).toHaveBeenCalledWith(
            VideoProjectEntity,
            { renderId: "render-1", status: "rendering" },
            { status: "draft", lastError: "It failed" },
        )
    })
})
