import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { VideoError, VideoErrorCode } from "./errors/video.error"
import { VideoMediaService } from "./video-media.service"
import type {
    ManagedVideoProject,
    WorkbenchFigures,
    WorkbenchProject,
    VideoSourceChoice,
    VideoWorkbenchScope,
} from "./video-workbench.contracts"
import type { BrandKit } from "./video-script.policy"
import type { StoredProject } from "./video-stored.contracts"
import {
    listVideoSources,
    listWorkbenchProjects,
    readVideoFigures,
    readWorkbenchBrand,
} from "./persistence/video-workbench.query"
import { workbenchProjectOf } from "./video-workbench.policy"

@Injectable()
/** Workspace checked workbench reads over saved projects, public sources, kits and activity. */
export class VideoWorkbenchService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
        private readonly media: VideoMediaService,
    ) {}

    /** The authenticated workspace and its edit permission. */
    async scope(principalId: string, workspaceId: string): Promise<VideoWorkbenchScope> {
        const member = await this.members.require(principalId, workspaceId)
        return { workspaceId, canEdit: member.role !== "staff" }
    }

    /** Newest projects, with short lived render links. */
    async list(
        principalId: string,
        workspaceId: string,
        includeArchived: boolean = false,
    ): Promise<ReadonlyArray<WorkbenchProject>> {
        await this.members.require(principalId, workspaceId)
        const rows = await listWorkbenchProjects(this.entityManager, workspaceId, null, includeArchived)
        return Promise.all(rows.map((row) => this.view(row, workspaceId)))
    }

    /** One selected project in the authenticated workspace. */
    async get(principalId: string, workspaceId: string, projectId: string): Promise<WorkbenchProject> {
        await this.members.require(principalId, workspaceId)
        const [row] = await listWorkbenchProjects(this.entityManager, workspaceId, projectId, true)
        if (row === undefined) throw new VideoError({ code: VideoErrorCode.ProjectNotFound, params: { projectId } })
        return this.view(row, workspaceId)
    }

    /** Selects a project only after proving the caller owns or manages its workspace. */
    async managed(principalId: string, workspaceId: string, projectId: string): Promise<ManagedVideoProject> {
        const member = await this.members.require(principalId, workspaceId, ["owner", "manager"])
        const project = await this.get(principalId, workspaceId, projectId)
        return { member, project }
    }

    /** The brand defaults to the workspace name until a manager saves it. */
    async brand(principalId: string, workspaceId: string): Promise<BrandKit> {
        await this.members.require(principalId, workspaceId)
        const row = await readWorkbenchBrand(this.entityManager, workspaceId)
        if (row === undefined)
            throw new VideoError({ code: VideoErrorCode.ProjectNotFound, params: { projectId: workspaceId } })
        return {
            shopName: row.shop_name?.trim() || row.workspace_name.trim(),
            primary: row.primary_color ?? "#16a34a",
            secondary: row.secondary_color ?? "#0f172a",
            logoPath: row.logo_path,
            musicTrack: row.music_track,
            voice: row.voice ?? "vi-VN-HoaiMyNeural",
        }
    }

    /** Only shared, public and readable video knowledge enters this source picker. */
    async sources(principalId: string, workspaceId: string): Promise<ReadonlyArray<VideoSourceChoice>> {
        await this.members.require(principalId, workspaceId)
        return listVideoSources(this.entityManager, workspaceId)
    }

    /** Current status counts and credits used in the last thirty days. */
    async figures(principalId: string, workspaceId: string): Promise<WorkbenchFigures> {
        await this.members.require(principalId, workspaceId)
        const row = await readVideoFigures(this.entityManager, workspaceId)
        if (row === undefined) throw new VideoError({ code: VideoErrorCode.InputInvalid })
        return row
    }

    private async view(row: StoredProject, workspaceId: string): Promise<WorkbenchProject> {
        return workbenchProjectOf(row, workspaceId, await this.media.render(row.render, workspaceId, row.title))
    }
}
