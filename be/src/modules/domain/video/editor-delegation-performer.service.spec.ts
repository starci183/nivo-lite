import { Test } from "@nestjs/testing"
import { builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { WORK_PERFORMER_REGISTRY } from "@modules/domain/decisions"
import type { Proposal, WorkContext, WorkItem, WorkPerformerRegistry } from "@modules/domain/decisions"
import { VideoDelegationsService } from "@modules/domain/video-delegations"
import { VideoProjectWorkbenchWriterService } from "@modules/domain/video-projects"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { VideoErrorCode } from "./errors/video.error"
import { EditorDelegationPerformerService, RENDER_SCRIPT_ACTION } from "./editor-delegation-performer.service"
import { VideoService } from "./video.service"

const WORKSPACE = "0a1b2c3d-0a1b-4c3d-8a1b-0a1b2c3d4e5f"
const CTX: WorkContext = { workspaceId: WORKSPACE, actor: "AI Marketing", locale: "vi" }

const PROPOSAL: Proposal = {
    summary: "Weekend",
    fields: {
        title: "Weekend",
        script: JSON.stringify([{ caption: "A", voiceover: "a", media: null }]),
        channels: "facebook,zalo",
    },
}

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: WORKSPACE,
    department: "video",
    action: RENDER_SCRIPT_ACTION,
    subject_type: "video_project",
    subject_id: null,
    lead_id: null,
    inbound_event_id: null,
    parent_id: null,
    chain_id: "item-1",
    depth: 1,
    status: "queued",
    decided_path: null,
    reason: "routine",
    reasons: [],
    missing_fields: [],
    proposal: PROPOSAL,
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    origin: "live",
    created_at: "2026-10-20T09:00:00.000Z",
    updated_at: "2026-10-20T09:00:00.000Z",
    completed_at: null,
    installation_id: null,
})

const build = async () => {
    const em = mockEntityManager()
    const tx = fakeTransaction(em)
    const registry = mock<WorkPerformerRegistry>()
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => `${key}:${JSON.stringify(params)}`)
    const video = mock<VideoService>()
    video.requestDelegatedRender.mockResolvedValue({ renderId: "render-1", projectId: "project-1" })
    const projects = mock<VideoProjectWorkbenchWriterService>()
    projects.createDelegated.mockResolvedValue("project-1")
    const delegations = mock<VideoDelegationsService>()
    delegations.ofWorkItem.mockResolvedValue(null)
    delegations.record.mockResolvedValue({ id: "delegation-1", project_id: "project-1" })
    delegations.linkRender.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            EditorDelegationPerformerService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: WORK_PERFORMER_REGISTRY, useValue: registry },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: VideoService, useValue: video },
            { provide: VideoProjectWorkbenchWriterService, useValue: projects },
            { provide: VideoDelegationsService, useValue: delegations },
        ],
    }).compile()
    return { performer: moduleRef.get(EditorDelegationPerformerService), tx, registry, video, projects, delegations }
}

describe("EditorDelegationPerformerService", () => {
    it("registers render_script and proposes what the command sent", async () => {
        const { performer, registry } = await build()

        performer.onModuleInit()

        expect(registry.add).toHaveBeenCalledWith("render_script", performer)
        await expect(performer.prepare(CTX, itemOf())).resolves.toEqual({ proposal: PROPOSAL })
    })

    it("creates the project and the delegation in one transaction and queues the framed render", async () => {
        const { performer, tx, video, projects, delegations } = await build()

        const done = await performer.perform(CTX, itemOf(), PROPOSAL)

        expect(done).toEqual({
            summary: 'video.editor.delegated:{"title":"Weekend","scenes":1}',
            evidence: "captured",
            href: "/agents/video/workbench?focus=project-1",
            detail: "project-1",
        })
        expect(projects.createDelegated).toHaveBeenCalledWith(expect.anything(), WORKSPACE, {
            title: "Weekend",
            goal: "offer",
            aspect: "9:16",
            targetSeconds: 10,
            script: [{ caption: "A", voiceover: "a", media: null }],
        })
        expect(delegations.record).toHaveBeenCalledWith(expect.anything(), {
            workspaceId: WORKSPACE,
            workItemId: "item-1",
            projectId: "project-1",
            sourceModule: "content",
            contentItemId: null,
            channels: ["facebook", "zalo"],
        })
        expect(tx.commits).toBe(1)
        expect(video.requestDelegatedRender).toHaveBeenCalledWith(WORKSPACE, "project-1")
        expect(delegations.linkRender).toHaveBeenCalledWith("delegation-1", "render-1")
    })

    it("answers the project a repeated work item already made and renders nothing", async () => {
        const { performer, video, delegations } = await build()
        delegations.ofWorkItem.mockResolvedValue({ id: "delegation-1", project_id: "project-7" })

        await expect(performer.perform(CTX, itemOf(), PROPOSAL)).resolves.toMatchObject({ detail: "project-7" })

        expect(video.requestDelegatedRender).not.toHaveBeenCalled()
    })

    it("refuses a script that cannot be rendered", async () => {
        const { performer, video } = await build()

        await expect(
            performer.perform(CTX, itemOf(), { summary: "x", fields: { title: "x", script: "[]" } }),
        ).rejects.toMatchObject({ code: VideoErrorCode.InputInvalid })
        expect(video.requestDelegatedRender).not.toHaveBeenCalled()
    })

    it("refuses when the project could not be written", async () => {
        const { performer, video, projects } = await build()
        projects.createDelegated.mockResolvedValue(null)

        await expect(performer.perform(CTX, itemOf(), PROPOSAL)).rejects.toMatchObject({
            code: VideoErrorCode.InputInvalid,
        })
        expect(video.requestDelegatedRender).not.toHaveBeenCalled()
    })

    it("refuses when the delegation could not be written", async () => {
        const { performer, video, delegations } = await build()
        delegations.record.mockResolvedValue(null)

        await expect(performer.perform(CTX, itemOf(), PROPOSAL)).rejects.toMatchObject({
            code: VideoErrorCode.InputInvalid,
        })
        expect(video.requestDelegatedRender).not.toHaveBeenCalled()
    })
})
