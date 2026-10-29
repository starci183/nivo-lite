import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { WORK_PERFORMER_REGISTRY } from "@modules/domain/decisions"
import type { PerformedBy, Proposal, WorkContext, WorkItem, WorkPerformerRegistry } from "@modules/domain/decisions"
import { VideoProjectWorkbenchWriterService } from "@modules/domain/video-projects"
import { VideoRendersService } from "@modules/domain/video-renders"
import { VideoErrorCode } from "./errors/video.error"
import { VideoApprovalPerformerService } from "./video-approval-performer.service"

const CTX: WorkContext = { workspaceId: "workspace-1", actor: "Lan", locale: "vi" }

const PROPOSAL: Proposal = {
    summary: "Spring offer",
    fields: { project_id: "project-1", render_id: "render-1", title: "Spring offer" },
}

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
    proposal: PROPOSAL,
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    created_at: "2026-10-13T09:00:00.000Z",
    updated_at: "2026-10-13T09:00:00.000Z",
    completed_at: null,
    installation_id: null,
})

const OWNER: PerformedBy = { name: "Lan", kind: "owner" }

const build = async () => {
    const writer = mock<VideoProjectWorkbenchWriterService>()
    writer.approve.mockResolvedValue(true)
    const renders = mock<VideoRendersService>()
    renders.isDone.mockResolvedValue(true)
    const registry = mock<WorkPerformerRegistry>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            VideoApprovalPerformerService,
            { provide: VideoProjectWorkbenchWriterService, useValue: writer },
            { provide: VideoRendersService, useValue: renders },
            { provide: WORK_PERFORMER_REGISTRY, useValue: registry },
        ],
    }).compile()
    return { performer: moduleRef.get(VideoApprovalPerformerService), writer, renders, registry }
}

describe("VideoApprovalPerformerService", () => {
    it("registers itself as the publish_video performer", async () => {
        const { performer, registry } = await build()

        performer.onModuleInit()

        expect(registry.add.mock.calls).toEqual([["publish_video", performer]])
    })

    describe("prepare", () => {
        it("keeps the saved proposal", async () => {
            const { performer } = await build()

            await expect(performer.prepare(CTX, itemOf())).resolves.toEqual({ proposal: PROPOSAL })
        })
    })

    describe("perform", () => {
        it("records the person's approval of the selected render", async () => {
            const { performer, writer, renders } = await build()

            await expect(performer.perform(CTX, itemOf(), PROPOSAL, OWNER)).resolves.toEqual({
                summary: "Spring offer",
                evidence: "captured",
                href: "/agents/video/workbench?focus=project-1",
            })
            expect(renders.isDone).toHaveBeenCalledWith("workspace-1", "render-1")
            expect(writer.approve).toHaveBeenCalledWith("workspace-1", "project-1", "render-1", "Lan")
        })

        it.each([
            ["an actor who is not a person", itemOf(), PROPOSAL, { name: "OpenClaw" }],
            ["another subject", itemOf({ subject_type: "lead" }), PROPOSAL, OWNER],
            ["an item with no project", itemOf({ subject_id: null }), PROPOSAL, OWNER],
            ["a proposal with no render", itemOf(), { ...PROPOSAL, fields: { project_id: "project-1" } }, OWNER],
        ])("refuses %s without writing", async (_label, item, proposal, by) => {
            const { performer, writer } = await build()

            await expect(performer.perform(CTX, item, proposal, by)).rejects.toMatchObject({
                code: VideoErrorCode.NotApproved,
            })
            expect(writer.approve).not.toHaveBeenCalled()
        })

        it("refuses a render that has not finished without writing", async () => {
            const { performer, writer, renders } = await build()
            renders.isDone.mockResolvedValue(false)

            await expect(performer.perform(CTX, itemOf(), PROPOSAL, OWNER)).rejects.toMatchObject({
                code: VideoErrorCode.NotApproved,
            })
            expect(writer.approve).not.toHaveBeenCalled()
        })

        it("refuses a render the project no longer accepts", async () => {
            const { performer, writer } = await build()
            writer.approve.mockResolvedValue(false)

            await expect(performer.perform(CTX, itemOf(), PROPOSAL, OWNER)).rejects.toMatchObject({
                code: VideoErrorCode.NotApproved,
            })
        })
    })
})
