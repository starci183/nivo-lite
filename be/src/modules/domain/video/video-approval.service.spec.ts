import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { WorkEngineService } from "@modules/domain/decisions"
import type { WorkItem } from "@modules/domain/decisions"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { VideoErrorCode } from "./errors/video.error"
import { VideoApprovalService } from "./video-approval.service"
import type { WorkbenchProject, WorkbenchRender } from "./video-workbench.contracts"
import { VideoWorkbenchService } from "./video-workbench.service"

const MEMBER: WorkspaceMember = {
    userId: "person-1",
    workspaceId: "workspace-1",
    role: "manager",
    staffId: null,
    displayName: "Lan",
    status: "active",
}

const RENDER: WorkbenchRender = {
    id: "render-1",
    status: "done",
    progress: 100,
    stage: null,
    durationMs: 15_000,
    sizeBytes: 1024,
    errorCode: null,
    videoUrl: "https://cdn/video.mp4?token=1",
    downloadUrl: null,
    posterUrl: null,
}

const projectOf = builder<WorkbenchProject>({
    id: "project-1",
    title: "Spring offer",
    goal: "offer",
    aspect: "9:16",
    targetSeconds: 30,
    status: "ready",
    inputs: { sourceIds: [], notes: "", media: [], auto: false },
    script: [
        { id: "scene-1", role: "hook", caption: "Fresh bread", voiceover: "", visual: "", media: null },
        { id: "scene-2", role: "cta", caption: "Visit today", voiceover: "", visual: "", media: null },
    ],
    version: 2,
    scriptMs: 900,
    lastErrorCode: null,
    render: RENDER,
    renderCount: 1,
    approvedAt: null,
    approvedByName: null,
    publishedAt: null,
    createdAt: "2026-10-13T09:00:00.000Z",
    updatedAt: "2026-10-13T09:00:00.000Z",
})

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "workspace-1",
    department: "video",
    action: "publish_video",
    subject_type: "video_project",
    subject_id: "project-1",
    lead_id: null,
    inbound_event_id: null,
    parent_id: null,
    chain_id: "item-1",
    depth: 0,
    status: "waiting_decision",
    decided_path: null,
    reason: "over_authority",
    reasons: ["over_authority"],
    missing_fields: [],
    proposal: { summary: "Spring offer", fields: {} },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    origin: "live",
    created_at: "2026-10-13T09:00:00.000Z",
    updated_at: "2026-10-13T09:00:00.000Z",
    completed_at: null,
    installation_id: null,
})

const APPROVED = projectOf({ status: "approved", approvedByName: "Lan" })

const build = async (project: WorkbenchProject = projectOf()) => {
    const workbench = mock<VideoWorkbenchService>()
    workbench.managed.mockResolvedValue({ member: MEMBER, project })
    workbench.get.mockResolvedValue(APPROVED)
    const engine = mock<WorkEngineService>()
    engine.runWork.mockResolvedValue(itemOf())
    engine.resumeWork.mockResolvedValue(itemOf({ status: "done" }))
    const moduleRef = await Test.createTestingModule({
        providers: [
            VideoApprovalService,
            { provide: VideoWorkbenchService, useValue: workbench },
            { provide: WorkEngineService, useValue: engine },
        ],
    }).compile()
    return { service: moduleRef.get(VideoApprovalService), workbench, engine }
}

describe("VideoApprovalService", () => {
    describe("approve", () => {
        it("opens the publish_video gate for the finished render, approves it and answers the saved project", async () => {
            const { service, engine, workbench } = await build()

            await expect(service.approve("person-1", "workspace-1", "project-1")).resolves.toBe(APPROVED)

            const ctx = { workspaceId: "workspace-1", actor: "Lan", locale: "vi" }
            expect(engine.runWork).toHaveBeenCalledWith(ctx, {
                action: "publish_video",
                subject_type: "video_project",
                subject_id: "project-1",
                origin: "live",
                preset: true,
                noChain: true,
                forceAsk: "over_authority",
                dedupeKey: "publish_video:project-1:render-1",
                seed: {
                    summary: "Spring offer",
                    draft: "Fresh bread\nVisit today",
                    fields: { project_id: "project-1", render_id: "render-1", title: "Spring offer" },
                },
            })
            expect(engine.resumeWork).toHaveBeenCalledWith(
                ctx,
                "item-1",
                "approved",
                {},
                { name: "Lan", kind: "owner" },
            )
            expect(workbench.get).toHaveBeenCalledWith("person-1", "workspace-1", "project-1")
        })

        it("accepts a gate the engine already closed", async () => {
            const { service, engine } = await build()
            engine.runWork.mockResolvedValue(itemOf({ status: "done" }))

            await expect(service.approve("person-1", "workspace-1", "project-1")).resolves.toBe(APPROVED)
            expect(engine.resumeWork).not.toHaveBeenCalled()
        })

        it.each(["approved", "published"])("answers an already %s project unchanged", async (status) => {
            const project = projectOf({ status })
            const { service, engine } = await build(project)

            await expect(service.approve("person-1", "workspace-1", "project-1")).resolves.toBe(project)
            expect(engine.runWork).not.toHaveBeenCalled()
        })

        it.each([
            ["a draft", projectOf({ status: "draft" })],
            ["a project with no render", projectOf({ render: null })],
            ["a render still running", projectOf({ render: { ...RENDER, status: "rendering" } })],
        ])("refuses %s", async (_label, project) => {
            const { service, engine } = await build(project)

            await expect(service.approve("person-1", "workspace-1", "project-1")).rejects.toMatchObject({
                code: VideoErrorCode.NotApproved,
            })
            expect(engine.runWork).not.toHaveBeenCalled()
        })

        it("refuses when the decision did not finish the work", async () => {
            const { service, engine } = await build()
            engine.resumeWork.mockResolvedValue(itemOf({ status: "failed" }))

            await expect(service.approve("person-1", "workspace-1", "project-1")).rejects.toMatchObject({
                code: VideoErrorCode.NotApproved,
            })
        })

        it("refuses when the gate ended in any other state", async () => {
            const { service, engine, workbench } = await build()
            engine.runWork.mockResolvedValue(itemOf({ status: "failed" }))

            await expect(service.approve("person-1", "workspace-1", "project-1")).rejects.toMatchObject({
                code: VideoErrorCode.NotApproved,
            })
            expect(workbench.get).not.toHaveBeenCalled()
        })
    })
})
