import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    LockedProjectLookup,
    OptionalProjectCardFacts,
    OptionalProjectCounts,
    OptionalProjectId,
    OptionalScriptProject,
    ProjectCounts,
    ProjectRow,
    RenderStart,
    RenderTitle,
    ScriptProjectRow,
} from "./video-projects.contracts"
import { VideoProjectEntity } from "./persistence/entities"

/** How many projects one workbench list reads. */
const WORKBENCH_PROJECTS_LIMIT = 60

/** How many projects one title lookup reads. */
const TITLE_PROJECTS_LIMIT = 500

@Injectable()
/** The `video_projects` rows: the project a render starts from, locked in the transaction that queues the render, the status the render leaves it in, and the reads of the workbench. */
export class VideoProjectsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The project, locked in the caller's transaction; null when it does not exist. */
    async lockForRender(manager: EntityManager, projectId: string): Promise<LockedProjectLookup> {
        const project = await manager.findOne(VideoProjectEntity, {
            where: { id: projectId },
            lock: { mode: "pessimistic_write" },
        })
        if (project === null) return null
        return {
            id: project.id,
            workspaceId: project.workspaceId,
            aspect: project.aspect,
            status: project.status,
            script: project.script,
            version: project.version,
            renderId: project.renderId,
        }
    }

    /** One project of the workspace as script generation reads it; locked against a second script request when `lock` is set. */
    readForScript(
        manager: EntityManager,
        workspaceId: string,
        projectId: string,
        lock: boolean,
    ): Promise<OptionalScriptProject> {
        const query = manager
            .createQueryBuilder(VideoProjectEntity, "p")
            .select("p.id", "id")
            .addSelect("p.title", "title")
            .addSelect("p.goal", "goal")
            .addSelect("p.aspect", "aspect")
            .addSelect("p.target_seconds", "target_seconds")
            .addSelect("p.status", "status")
            .addSelect("p.inputs", "inputs")
            .addSelect("p.script_meta", "script_meta")
            .addSelect("p.updated_at", "updated_at")
            .addSelect("p.render_id", "render_id")
            .where("p.workspace_id = :workspaceId AND p.id = :projectId", { workspaceId, projectId })
            .limit(1)
        return (lock ? query.setLock("pessimistic_write", undefined, ["p"]) : query).getRawOne<ScriptProjectRow>()
    }

    /** The projects of a workspace, newest first; one project when `projectId` names it. */
    listForWorkbench(
        workspaceId: string,
        projectId: OptionalProjectId,
        includeArchived: boolean,
    ): Promise<Array<ProjectRow>> {
        return this.entityManager
            .createQueryBuilder(VideoProjectEntity, "p")
            .select("p.*")
            .where("p.workspace_id = :workspaceId AND (:projectId::uuid IS NULL OR p.id = :projectId)", {
                workspaceId,
                projectId,
            })
            .andWhere("(:includeArchived::boolean OR p.status <> 'archived')", { includeArchived })
            .orderBy("p.updatedAt", "DESC")
            .limit(WORKBENCH_PROJECTS_LIMIT)
            .getRawMany<ProjectRow>()
    }

    /** The project counts by state; undefined when the count cannot be read. */
    countsOf(workspaceId: string): Promise<OptionalProjectCounts> {
        return this.entityManager
            .createQueryBuilder(VideoProjectEntity, "p")
            .select("count(*) FILTER (WHERE p.status = 'rendering')::int", "rendering")
            .addSelect("count(*) FILTER (WHERE p.status = 'scripting')::int", "scripting")
            .addSelect("count(*) FILTER (WHERE p.status IN ('ready', 'approved'))::int", "readyToPublish")
            .addSelect("count(*) FILTER (WHERE p.status = 'approved')::int", "approved")
            .addSelect(
                "count(*) FILTER (WHERE p.status = 'published' AND p.published_at >= now() - interval '30 days')::int",
                "published30",
            )
            .where("p.workspace_id = :workspaceId", { workspaceId })
            .getRawOne<ProjectCounts>()
    }

    /** The title of the newest project each of the renders belongs to; a render no project holds is missing from the answer. */
    async titlesOfRenders(workspaceId: string, renderIds: ReadonlyArray<string>): Promise<Array<RenderTitle>> {
        if (renderIds.length === 0) return []
        const wanted = new Set(renderIds)
        const projects = await this.entityManager
            .createQueryBuilder(VideoProjectEntity, "p")
            .select("p.title", "title")
            .addSelect("p.render_id", "render_id")
            .addSelect("p.render_ids", "render_ids")
            .where("p.workspace_id = :workspaceId", { workspaceId })
            .andWhere("(p.render_id = ANY(:ids::uuid[]) OR p.render_ids && :ids::uuid[])", { ids: [...wanted] })
            .orderBy("p.updated_at", "DESC")
            .addOrderBy("p.id", "DESC")
            .limit(TITLE_PROJECTS_LIMIT)
            .getRawMany<{ title: string; render_id: string | null; render_ids: Array<string> }>()
        const titles = new Map<string, string>()
        for (const project of projects) {
            for (const renderId of [project.render_id, ...project.render_ids]) {
                if (renderId !== null && wanted.has(renderId) && !titles.has(renderId)) {
                    titles.set(renderId, project.title)
                }
            }
        }
        return [...titles].map(([renderId, title]) => ({ renderId, title }))
    }

    /** What a delegation card shows of a project of the workspace; null when there is none. */
    async cardFactsOf(workspaceId: string, projectId: string): Promise<OptionalProjectCardFacts> {
        const project = await this.entityManager.findOne(VideoProjectEntity, {
            select: { title: true, aspect: true, script: true },
            where: { id: projectId, workspaceId },
        })
        return project === null ? null : { title: project.title, aspect: project.aspect, script: project.script }
    }

    /**
     * Points the project at its new render and opens its next version, in the caller's transaction; an earlier approval no longer
     * holds.
     */
    async startRender(manager: EntityManager, start: RenderStart): Promise<void> {
        await manager
            .createQueryBuilder(VideoProjectEntity, "v")
            .update()
            .set({
                status: "rendering",
                renderId: start.renderId,
                renderIds: () => "array_append(render_ids, CAST(:appendedRenderId AS uuid))",
                currentSpec: () => "CAST(:spec AS jsonb)",
                version: () => "version + 1",
                lastError: null,
                approvedAt: null,
                approvedByName: null,
                publishedAt: null,
            })
            .where("id = :projectId", { projectId: start.projectId })
            .setParameters({ appendedRenderId: start.renderId, spec: start.spec })
            .execute()
    }

    /** Makes the project of a finished render ready to approve, in the caller's transaction. */
    async markReady(manager: EntityManager, renderId: string): Promise<void> {
        await manager.update(
            VideoProjectEntity,
            { renderId, status: "rendering" },
            { status: "ready", lastError: null },
        )
    }

    /** Sends the project of a failed render back to draft with the reason, in the caller's transaction. */
    async markDraft(manager: EntityManager, renderId: string, reason: string): Promise<void> {
        await manager.update(
            VideoProjectEntity,
            { renderId, status: "rendering" },
            { status: "draft", lastError: reason },
        )
    }
}
