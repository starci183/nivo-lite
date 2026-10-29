import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { KnowledgeSourcesReadService } from "@modules/domain/knowledge-sources"
import { ContextVersionsService } from "@modules/domain/module-context-versions"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { NivoKnowledgeService } from "@modules/domain/nivo-knowledge"
import { VideoBrandKitsService } from "@modules/domain/video-brand-kits"
import { VideoProjectsService } from "@modules/domain/video-projects"
import { VideoRendersService } from "@modules/domain/video-renders"
import { WorkspacesService } from "@modules/domain/workspaces"
import type { ScriptBase, ScriptProject, ScriptSetup, ScriptSource } from "./video-stored.contracts"

/** The module whose knowledge, installation and house rules script generation reads. */
const VIDEO_MODULE = "video"

/** How many selected sources one script request reads. */
const SCRIPT_SOURCES_LIMIT = 12

/** How many house rules one script request reads. */
const SCRIPT_BASE_LIMIT = 20

/** The modules and kinds of the house authority, escalation and tone rules of video and the core agent. */
const BASE_MODULES: ReadonlyArray<string> = [VIDEO_MODULE, "core"]
const BASE_KINDS: ReadonlyArray<string> = ["authority", "escalation", "tone"]

@Injectable()
/** The reads of script generation, each asked of the capability that owns the rows: the project, its render, the brand name, public sources, the approved setup and the house rules. */
export class VideoScriptReadsService {
    constructor(
        private readonly projects: VideoProjectsService,
        private readonly renders: VideoRendersService,
        private readonly brandKits: VideoBrandKitsService,
        private readonly workspaces: WorkspacesService,
        private readonly knowledge: KnowledgeSourcesReadService,
        private readonly installations: InstallationRecordsService,
        private readonly versions: ContextVersionsService,
        private readonly nivo: NivoKnowledgeService,
    ) {}

    /** One project of the workspace with its render status, workspace name and brand name; locked against a second script request when `lock` is set. */
    async projectOf(
        manager: EntityManager,
        workspaceId: string,
        projectId: string,
        lock: boolean,
    ): Promise<ScriptProject | undefined> {
        const row = await this.projects.readForScript(manager, workspaceId, projectId, lock)
        if (row === undefined) return undefined
        const { render_id: renderId, ...project } = row
        const [renderStatus, workspaceName, kit] = await Promise.all([
            renderId === null ? Promise.resolve(null) : this.renders.stateOf(renderId),
            this.workspaces.nameOf(workspaceId),
            this.brandKits.kitOf(workspaceId),
        ])
        return {
            ...project,
            render_status: renderStatus,
            workspace_name: workspaceName,
            shop_name: kit?.shopName ?? null,
        }
    }

    /** The public, readable video sources the project selected; none when nothing is selected. */
    sourcesOf(workspaceId: string, sourceIds: ReadonlyArray<string>): Promise<ReadonlyArray<ScriptSource>> {
        return this.knowledge.publicTexts(workspaceId, VIDEO_MODULE, sourceIds, SCRIPT_SOURCES_LIMIT)
    }

    /** The approved configuration of the oldest video installation of the workspace; none before the first apply. */
    async setupOf(workspaceId: string): Promise<Array<ScriptSetup>> {
        const installation = await this.installations.firstOfModule(workspaceId, VIDEO_MODULE)
        const versionId = installation?.activeContextVersionId ?? null
        if (installation === null || versionId === null) return []
        const version = await this.versions.find(versionId)
        return version?.installationId === installation.id ? [{ snapshot: version.snapshot }] : []
    }

    /** The house authority, escalation and tone rules of video and the core agent. */
    baseRules(): Promise<ReadonlyArray<ScriptBase>> {
        return this.nivo.rulesOf(BASE_MODULES, BASE_KINDS, SCRIPT_BASE_LIMIT)
    }
}
