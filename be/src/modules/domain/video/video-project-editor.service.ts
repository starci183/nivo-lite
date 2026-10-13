import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { EventsService } from "@modules/domain/events"
import { VideoProjectWorkbenchWriterService } from "@modules/domain/video-projects"
import { VideoError, VideoErrorCode } from "./errors/video.error"
import { VideoWorkbenchService } from "./video-workbench.service"
import type { NewWorkbenchProject, WorkbenchProject, WorkbenchProjectPatch } from "./video-workbench.contracts"
import { editorScenesOf, videoInputsOf, workspaceMediaPath } from "./video-workbench.policy"
import type { BrandKit } from "./video-script.policy"
import { MUSIC_TRACKS, TTS_VOICES, normaliseColor } from "./video-spec.policy"
import { VideoBrandKitsService } from "@modules/domain/video-brand-kits"

@Injectable()
/** Owners and managers create and edit video drafts and record their own publication. */
export class VideoProjectEditorService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
        private readonly workbench: VideoWorkbenchService,
        private readonly writer: VideoProjectWorkbenchWriterService,
        private readonly events: EventsService,
        private readonly brands: VideoBrandKitsService,
    ) {}

    /** Creates a new workspace draft with only local files and bounded public source references. */
    async create(principalId: string, workspaceId: string, input: NewWorkbenchProject): Promise<WorkbenchProject> {
        const member = await this.members.require(principalId, workspaceId, ["owner", "manager"])
        const created = await this.entityManager.transaction(async (tx) => {
            const id = await this.writer.create(tx, workspaceId, principalId, {
                ...input,
                inputs: videoInputsOf(input.inputs, workspaceId),
            })
            if (id === null) throw new VideoError({ code: VideoErrorCode.InputInvalid })
            await this.events.record(
                {
                    workspaceId,
                    kind: "video.project_created",
                    actor: member.displayName,
                    summary: input.title ?? input.goal,
                },
                tx,
            )
            return id
        })
        return this.workbench.get(principalId, workspaceId, created)
    }

    /** Changes an idle project; a script edit invalidates the previous approval. */
    async update(
        principalId: string,
        workspaceId: string,
        projectId: string,
        input: WorkbenchProjectPatch,
    ): Promise<WorkbenchProject> {
        await this.members.require(principalId, workspaceId, ["owner", "manager"])
        await this.workbench.get(principalId, workspaceId, projectId)
        const changed = await this.writer.update(workspaceId, projectId, {
            ...input,
            ...(input.inputs === undefined ? {} : { inputs: videoInputsOf(input.inputs, workspaceId) }),
            ...(input.script === undefined ? {} : { script: editorScenesOf(input.script, workspaceId) }),
        })
        if (!changed) throw new VideoError({ code: VideoErrorCode.ProjectBusy, params: { projectId } })
        return this.workbench.get(principalId, workspaceId, projectId)
    }

    /** Copies a project into a fresh draft. */
    async duplicate(principalId: string, workspaceId: string, projectId: string): Promise<WorkbenchProject> {
        const member = await this.members.require(principalId, workspaceId, ["owner", "manager"])
        const copied = await this.entityManager.transaction(async (tx) => {
            const id = await this.writer.duplicate(tx, workspaceId, projectId, principalId)
            if (id === null) throw new VideoError({ code: VideoErrorCode.ProjectNotFound, params: { projectId } })
            await this.events.record(
                { workspaceId, kind: "video.project_duplicated", actor: member.displayName, summary: projectId },
                tx,
            )
            return id
        })
        return this.workbench.get(principalId, workspaceId, copied)
    }

    /** Archives or restores an idle project. */
    async archive(
        principalId: string,
        workspaceId: string,
        projectId: string,
        archived: boolean,
    ): Promise<WorkbenchProject> {
        await this.members.require(principalId, workspaceId, ["owner", "manager"])
        await this.workbench.get(principalId, workspaceId, projectId)
        if (!(await this.writer.archive(workspaceId, projectId, archived))) {
            throw new VideoError({ code: VideoErrorCode.ProjectBusy, params: { projectId } })
        }
        return this.workbench.get(principalId, workspaceId, projectId)
    }

    /** Records that the manager posted a previously approved video. */
    async publish(principalId: string, workspaceId: string, projectId: string): Promise<WorkbenchProject> {
        const member = await this.members.require(principalId, workspaceId, ["owner", "manager"])
        await this.entityManager.transaction(async (tx) => {
            if (!(await this.writer.publish(tx, workspaceId, projectId)))
                throw new VideoError({ code: VideoErrorCode.NotApproved })
            await this.events.record(
                { workspaceId, kind: "video.published_by_owner", actor: member.displayName, summary: projectId },
                tx,
            )
        })
        return this.workbench.get(principalId, workspaceId, projectId)
    }

    /** Saves colors, voice and logo for future renders. */
    async saveBrand(principalId: string, workspaceId: string, brand: BrandKit): Promise<BrandKit> {
        await this.members.require(principalId, workspaceId, ["owner", "manager"])
        const logoPath = brand.logoPath ?? null
        if (logoPath !== null && !workspaceMediaPath(logoPath, workspaceId)) {
            throw new VideoError({ code: VideoErrorCode.InputInvalid })
        }
        await this.brands.save(workspaceId, principalId, {
            shopName: brand.shopName.trim(),
            primary: normaliseColor(brand.primary),
            secondary: normaliseColor(brand.secondary),
            logoPath,
            musicTrack: MUSIC_TRACKS.find((track) => track.id === brand.musicTrack)?.id ?? null,
            voice: TTS_VOICES.find((voice) => voice === brand.voice) ?? "vi-VN-HoaiMyNeural",
        })
        return this.workbench.brand(principalId, workspaceId)
    }
}
