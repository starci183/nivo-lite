import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import {
    DRAFT_PROJECT,
    MARK_PROJECT_RENDERING,
    READY_PROJECT,
    SELECT_PROJECT_FOR_RENDER,
} from "./persistence/video-projects.sql"
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

describe("VideoProjectsService", () => {
    describe("forRender", () => {
        it("answers the project with its brand kit", async () => {
            const manager = mockEntityManager({ query: [SELECT_PROJECT_FOR_RENDER, [ROW]] })
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
            expect(manager.query).toHaveBeenCalledWith(SELECT_PROJECT_FOR_RENDER, ["project-1"])
        })

        it("answers nothing when the project does not exist ", async () => {
            const manager = mockEntityManager({ query: [SELECT_PROJECT_FOR_RENDER, []] })
            const projects = await build()

            await expect(projects.forRender(manager, "project-1")).resolves.toBeNull()
        })
    })

    describe("startRender", () => {
        it("points the project at its new render", async () => {
            const manager = mockEntityManager({ query: [MARK_PROJECT_RENDERING, []] })
            const projects = await build()

            await projects.startRender(manager, { projectId: "project-1", renderId: "render-1", spec: '{"version":1}' })

            expect(manager.query).toHaveBeenCalledWith(MARK_PROJECT_RENDERING, [
                "project-1",
                "render-1",
                '{"version":1}',
            ])
        })
    })

    describe("markReady and markDraft", () => {
        it("makes the project of a finished render ready", async () => {
            const manager = mockEntityManager({ query: [READY_PROJECT, []] })
            const projects = await build()

            await projects.markReady(manager, "render-1")

            expect(manager.query).toHaveBeenCalledWith(READY_PROJECT, ["render-1"])
        })

        it("sends the project of a failed render back to draft with the reason", async () => {
            const manager = mockEntityManager({ query: [DRAFT_PROJECT, []] })
            const projects = await build()

            await projects.markDraft(manager, "render-1", "It failed")

            expect(manager.query).toHaveBeenCalledWith(DRAFT_PROJECT, ["render-1", "It failed"])
        })
    })
})
