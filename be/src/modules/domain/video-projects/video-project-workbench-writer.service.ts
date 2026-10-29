import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import type {
    DelegatedVideoProjectDraft,
    NewVideoProjectDraft,
    ChangeVideoProjectDraft,
    WrittenVideoProjectId,
} from "./video-project-workbench.contracts"
import { VideoProjectEntity } from "./persistence/entities"
import type { VideoProjectAspect, VideoProjectGoal, VideoProjectJson } from "./persistence/entities"

/** The longest title a copy may carry. */
const TITLE_MAX = 120

/** The states in which a project is busy and refuses edits, archiving and restoring. */
const BUSY = "status NOT IN ('scripting', 'rendering')"

/** Identity returned by an owner write. */
interface ProjectIdentity {
    /** Saved project. */
    readonly id: string
}

@Injectable()
/** The owner of video_projects writes used by the manager workbench and approval gate. */
export class VideoProjectWorkbenchWriterService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Creates a project in the caller's evidence transaction. */
    async create(
        tx: EntityManager,
        workspaceId: string,
        principalId: string,
        input: NewVideoProjectDraft,
    ): Promise<WrittenVideoProjectId> {
        const typed = input.title?.trim() ?? ""
        const result = await tx
            .createQueryBuilder(VideoProjectEntity, "v")
            .insert()
            .values({
                workspaceId,
                title: typed || `${input.goal} - ${this.clock.now().toISOString().slice(0, 10)}`,
                goal: input.goal as VideoProjectGoal,
                aspect: input.aspect as VideoProjectAspect,
                targetSeconds: input.targetSeconds,
                inputs: input.inputs as VideoProjectJson,
                scriptMeta: typed === "" ? { auto_title: true } : {},
                createdBy: principalId,
            })
            .returning("id")
            .execute()
        const [row] = result.raw as Array<ProjectIdentity>
        return row?.id ?? null
    }

    /** Creates the project of a delegated script in the caller's transaction; no person is its creator. */
    async createDelegated(
        tx: EntityManager,
        workspaceId: string,
        input: DelegatedVideoProjectDraft,
    ): Promise<WrittenVideoProjectId> {
        const result = await tx
            .createQueryBuilder(VideoProjectEntity, "v")
            .insert()
            .values({
                workspaceId,
                title: input.title,
                goal: input.goal as VideoProjectGoal,
                aspect: input.aspect as VideoProjectAspect,
                targetSeconds: input.targetSeconds,
                script: input.script as VideoProjectJson,
                inputs: {},
                scriptMeta: { delegated: true },
                createdBy: null,
            })
            .returning("id")
            .execute()
        const [row] = result.raw as Array<ProjectIdentity>
        return row?.id ?? null
    }

    /** Updates an idle project and invalidates a script approval. */
    async update(workspaceId: string, projectId: string, input: ChangeVideoProjectDraft): Promise<boolean> {
        const scripted = "CAST(:script AS jsonb) IS NOT NULL"
        const result = await this.entityManager
            .createQueryBuilder(VideoProjectEntity, "v")
            .update()
            .set({
                title: () => "COALESCE(NULLIF(CAST(:title AS text), ''), title)",
                goal: () => "COALESCE(CAST(:goal AS text), goal)",
                aspect: () => "COALESCE(CAST(:aspect AS text), aspect)",
                targetSeconds: () => "COALESCE(CAST(:targetSeconds AS integer), target_seconds)",
                inputs: () => "COALESCE(CAST(:inputs AS jsonb), inputs)",
                script: () => "COALESCE(CAST(:script AS jsonb), script)",
                status: () =>
                    `CASE WHEN ${scripted} AND status IN ('ready', 'approved', 'published') THEN 'draft' ELSE status END`,
                approvedAt: () => `CASE WHEN ${scripted} THEN NULL ELSE approved_at END`,
                approvedByName: () => `CASE WHEN ${scripted} THEN NULL ELSE approved_by_name END`,
                publishedAt: () => `CASE WHEN ${scripted} THEN NULL ELSE published_at END`,
            })
            .where(`workspace_id = :workspaceId AND id = :projectId AND ${BUSY}`, { workspaceId, projectId })
            .setParameters({
                title: input.title ?? null,
                goal: input.goal ?? null,
                aspect: input.aspect ?? null,
                targetSeconds: input.targetSeconds ?? null,
                inputs: input.inputs === undefined ? null : JSON.stringify(input.inputs),
                script: input.script === undefined ? null : JSON.stringify(input.script),
            })
            .returning("id")
            .execute()
        return (result.raw as Array<ProjectIdentity>).length > 0
    }

    /** Copies a project into a fresh draft inside the caller's evidence transaction; null when the workspace has no such project. */
    async duplicate(
        tx: EntityManager,
        workspaceId: string,
        projectId: string,
        principalId: string,
    ): Promise<WrittenVideoProjectId> {
        // The source is read-locked until the transaction ends, so no edit slips in between the read and the copy.
        const source = await tx.findOne(VideoProjectEntity, {
            where: { workspaceId, id: projectId },
            lock: { mode: "pessimistic_read" },
        })
        if (source === null) return null
        const result = await tx
            .createQueryBuilder(VideoProjectEntity, "v")
            .insert()
            .values({
                workspaceId: source.workspaceId,
                title: Array.from(`${source.title} (copy)`).slice(0, TITLE_MAX).join(""),
                goal: source.goal,
                aspect: source.aspect,
                targetSeconds: source.targetSeconds,
                inputs: source.inputs,
                script: source.script,
                sourceProjectId: source.id,
                createdBy: principalId,
            })
            .returning("id")
            .execute()
        const [row] = result.raw as Array<ProjectIdentity>
        return row?.id ?? null
    }

    /** Changes only an idle project's archived status. */
    async archive(workspaceId: string, projectId: string, archived: boolean): Promise<boolean> {
        const result = await this.entityManager
            .createQueryBuilder(VideoProjectEntity, "v")
            .update()
            .set({
                status: () =>
                    "CASE WHEN CAST(:archived AS boolean) THEN 'archived' WHEN render_id IS NULL THEN 'draft' ELSE 'ready' END",
            })
            .where(`workspace_id = :workspaceId AND id = :projectId AND ${BUSY}`, { workspaceId, projectId })
            .setParameter("archived", archived)
            .returning("id")
            .execute()
        return (result.raw as Array<ProjectIdentity>).length > 0
    }

    /** Publishes only an approved project inside the evidence transaction. */
    async publish(tx: EntityManager, workspaceId: string, projectId: string): Promise<boolean> {
        const result = await tx
            .createQueryBuilder(VideoProjectEntity, "v")
            .update()
            .set({ status: "published", publishedAt: () => "now()" })
            .where("workspace_id = :workspaceId AND id = :projectId AND status = 'approved'", {
                workspaceId,
                projectId,
            })
            .returning("id")
            .execute()
        return (result.raw as Array<ProjectIdentity>).length > 0
    }

    /** Records the authority performer's human approval of a finished render; a repeated decision keeps the first approver. */
    async approve(workspaceId: string, projectId: string, renderId: string, approver: string): Promise<boolean> {
        const result = await this.entityManager
            .createQueryBuilder(VideoProjectEntity, "v")
            .update()
            .set({ status: "approved", approvedAt: () => "now()", approvedByName: approver })
            .where("workspace_id = :workspaceId AND id = :projectId AND render_id = :renderId AND status = 'ready'", {
                workspaceId,
                projectId,
                renderId,
            })
            .andWhere(
                "EXISTS (SELECT 1 FROM public.video_renders r WHERE r.id = video_projects.render_id " +
                    "AND r.workspace_id = video_projects.workspace_id AND r.status = 'done')",
            )
            .returning("id")
            .execute()
        return (result.raw as Array<ProjectIdentity>).length > 0
    }
}
