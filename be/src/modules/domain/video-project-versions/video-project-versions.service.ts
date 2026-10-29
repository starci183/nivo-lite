import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { VideoRendersError, VideoRendersErrorCode } from "@modules/domain/video-renders"
import { parseJsonText } from "@modules/platform/primitives"
import type { ProjectVersion } from "./video-project-versions.contracts"
import { VideoProjectVersionEntity } from "./persistence/entities"

@Injectable()
/** The `video_project_versions` rows: one snapshot per render, written in the transaction that queues the render. */
export class VideoProjectVersionsService {
    /** Writes the snapshot in the caller's transaction. */
    async record(manager: EntityManager, version: ProjectVersion): Promise<void> {
        const script = parseJsonText(version.script)
        const spec = parseJsonText(version.spec)
        if (!script.ok || !spec.ok) throw new VideoRendersError({ code: VideoRendersErrorCode.JsonUnreadable })
        await manager.save(VideoProjectVersionEntity, {
            projectId: version.projectId,
            workspaceId: version.workspaceId,
            version: version.version,
            script: script.value as unknown,
            spec: spec.value as unknown,
            renderId: version.renderId,
            createdBy: version.createdBy,
        })
    }
}
