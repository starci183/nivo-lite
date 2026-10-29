import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { VideoBrandKitEntity } from "@modules/domain/video-brand-kits"
import { VideoRenderEntity } from "@modules/domain/video-renders"
import { WorkspaceEntity } from "@modules/domain/workspaces"
import { resolveFragments } from "@tests/fixtures/builders/sql-fragments.builder"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { VideoProjectEntity } from "./persistence/entities"
import { VideoProjectsService } from "./video-projects.service"

const ROW = {
    id: "project-1",
    workspace_id: "workspace-1",
    aspect: "9:16",
    status: "draft",
    script: [{ caption: "Hello" }],
    version: 3,
    render_status: "done",
    workspace_name: "Bakery",
    shop_name: "Bakery Shop",
    primary_color: "#16a34a",
    secondary_color: "#0f172a",
    logo_path: "workspace-1/logo.png",
    music_track: "calm-glow",
    voice: "vi-VN-NamMinhNeural",
}

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [VideoProjectsService] }).compile()
    return moduleRef.get(VideoProjectsService)
}

/** A manager double whose only query builder answers the given terminals and records the chain. */
const managerAnswering = (answers: QueryBuilderAnswers) => {
    const manager = mockEntityManager()
    const fake = fakeQueryBuilder(answers)
    manager.createQueryBuilder.mockReturnValue(fake.builder as never)
    return { manager, fake }
}

describe("VideoProjectsService", () => {
    describe("forRender", () => {
        it("answers the project with its brand kit, locking only the project row", async () => {
            const { manager, fake } = managerAnswering({ getRawOne: ROW })
            const projects = await build()

            await expect(projects.forRender(manager, "project-1")).resolves.toEqual({
                id: "project-1",
                workspaceId: "workspace-1",
                aspect: "9:16",
                status: "draft",
                script: [{ caption: "Hello" }],
                version: 3,
                renderStatus: "done",
                workspaceName: "Bakery",
                brand: {
                    shopName: "Bakery Shop",
                    primary: "#16a34a",
                    secondary: "#0f172a",
                    logoPath: "workspace-1/logo.png",
                    musicTrack: "calm-glow",
                    voice: "vi-VN-NamMinhNeural",
                },
            })
            expect(manager.createQueryBuilder).toHaveBeenCalledWith(VideoProjectEntity, "p")
            expect(fake.callsOf("innerJoin")).toEqual([[WorkspaceEntity, "w", "w.id = p.workspaceId"]])
            expect(fake.callsOf("leftJoin")).toEqual([
                [VideoBrandKitEntity, "k", "k.workspaceId = p.workspaceId"],
                [VideoRenderEntity, "r", "r.id = p.renderId"],
            ])
            expect(fake.callsOf("where")).toEqual([["p.id = :projectId", { projectId: "project-1" }]])
            expect(fake.callsOf("setLock")).toEqual([["pessimistic_write", undefined, ["p"]]])
        })

        it("answers nothing when the project does not exist ", async () => {
            const { manager } = managerAnswering({ getRawOne: undefined })
            const projects = await build()

            await expect(projects.forRender(manager, "project-1")).resolves.toBeNull()
        })
    })
})

describe("VideoProjectsService render lifecycle", () => {
    describe("startRender", () => {
        it("points the project at its new render, opens its next version and drops an earlier approval", async () => {
            const { manager, fake } = managerAnswering({ execute: { raw: [] } })
            const projects = await build()

            await projects.startRender(manager, { projectId: "project-1", renderId: "render-1", spec: '{"version":1}' })

            expect(manager.createQueryBuilder).toHaveBeenCalledWith(VideoProjectEntity, "v")

            expect(fake.callsOf("update")).toEqual([[]])
            expect(fake.callsOf("set").map(([set]) => resolveFragments(set))).toEqual([
                {
                    status: "rendering",
                    renderId: "render-1",
                    renderIds: "array_append(render_ids, CAST(:appendedRenderId AS uuid))",
                    currentSpec: "CAST(:spec AS jsonb)",
                    version: "version + 1",
                    lastError: null,
                    approvedAt: null,
                    approvedByName: null,
                    publishedAt: null,
                },
            ])
            expect(fake.callsOf("where")).toEqual([["id = :projectId", { projectId: "project-1" }]])
            expect(fake.callsOf("setParameters")).toEqual([[{ appendedRenderId: "render-1", spec: '{"version":1}' }]])
        })
    })

    describe("markReady and markDraft", () => {
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
})
