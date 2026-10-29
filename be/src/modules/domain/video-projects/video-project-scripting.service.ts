import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { VideoProjectScriptFailure, VideoProjectScriptFinish } from "./video-project-scripting.contracts"
import { VideoProjectEntity } from "./persistence/entities"

/** The guard that lets only the generation that owns the project write: the project still scripts and carries the generation id. */
const OWNING_GENERATION =
    "workspace_id = :workspaceId AND id = :projectId AND status = 'scripting' AND script_meta ->> 'generation_id' = :generationId"

@Injectable()
/** The project table's script writes participate in the orchestration transaction. */
export class VideoProjectScriptingService {
    /** Stores the operation metadata with its queue job or correction job. */
    async start(tx: EntityManager, workspaceId: string, projectId: string, meta: string): Promise<void> {
        await tx
            .createQueryBuilder(VideoProjectEntity, "v")
            .update()
            .set({ status: "scripting", lastError: null, scriptMeta: () => "CAST(:meta AS jsonb)" })
            .where("workspace_id = :workspaceId AND id = :projectId", { workspaceId, projectId })
            .setParameter("meta", meta)
            .execute()
    }

    /** Stores scenes only while this generation owns the project; an earlier approval no longer holds. */
    async finish(tx: EntityManager, input: VideoProjectScriptFinish): Promise<void> {
        await tx
            .createQueryBuilder(VideoProjectEntity, "v")
            .update()
            .set({
                status: "draft",
                script: () => "CAST(:script AS jsonb)",
                scriptMs: input.durationMs,
                title: () => "coalesce(CAST(:title AS text), title)",
                lastError: null,
                scriptMeta: () => "CAST(:meta AS jsonb)",
                approvedAt: null,
                approvedByName: null,
                publishedAt: null,
            })
            .where(OWNING_GENERATION, {
                workspaceId: input.workspaceId,
                projectId: input.projectId,
                generationId: input.generationId,
            })
            .setParameters({ script: input.script, title: input.title, meta: input.meta })
            .execute()
    }

    /** Stores a stable failure only while this generation owns the project. */
    async fail(tx: EntityManager, input: VideoProjectScriptFailure): Promise<void> {
        await tx
            .createQueryBuilder(VideoProjectEntity, "v")
            .update()
            .set({ status: "draft", lastError: input.code, scriptMeta: () => "CAST(:meta AS jsonb)" })
            .where(OWNING_GENERATION, {
                workspaceId: input.workspaceId,
                projectId: input.projectId,
                generationId: input.generationId,
            })
            .setParameter("meta", input.meta)
            .execute()
    }
}
