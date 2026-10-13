import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { VideoProjectScriptFailure, VideoProjectScriptFinish } from "./video-project-scripting.contracts"
import { FAIL_SCRIPT_PROJECT, FINISH_SCRIPT_PROJECT, START_SCRIPT_PROJECT } from "./persistence/video-scripting.sql"

@Injectable()
/** The project table's script writes participate in the orchestration transaction. */
export class VideoProjectScriptingService {
    /** Stores the operation metadata with its queue job or correction job. */
    async start(tx: EntityManager, workspaceId: string, projectId: string, meta: string): Promise<void> {
        await tx.query(START_SCRIPT_PROJECT, [workspaceId, projectId, meta])
    }

    /** Stores scenes only while this generation owns the project. */
    async finish(tx: EntityManager, input: VideoProjectScriptFinish): Promise<void> {
        await tx.query(FINISH_SCRIPT_PROJECT, [
            input.workspaceId,
            input.projectId,
            input.generationId,
            input.script,
            input.durationMs,
            input.title,
            input.meta,
        ])
    }

    /** Stores a stable failure only while this generation owns the project. */
    async fail(tx: EntityManager, input: VideoProjectScriptFailure): Promise<void> {
        await tx.query(FAIL_SCRIPT_PROJECT, [
            input.workspaceId,
            input.projectId,
            input.generationId,
            input.code,
            input.meta,
        ])
    }
}
