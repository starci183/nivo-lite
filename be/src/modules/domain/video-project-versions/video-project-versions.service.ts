import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { ProjectVersion } from "./video-project-versions.contracts"
import { INSERT_PROJECT_VERSION } from "./persistence/video-project-versions.sql"

@Injectable()
/** The `video_project_versions` rows: one snapshot per render, written in the transaction that queues the render. */
export class VideoProjectVersionsService {
    /** Writes the snapshot in the caller's transaction. */
    async record(manager: EntityManager, version: ProjectVersion): Promise<void> {
        await manager.query(INSERT_PROJECT_VERSION, [
            version.projectId,
            version.workspaceId,
            version.version,
            version.script,
            version.spec,
            version.renderId,
            version.createdBy,
        ])
    }
}
