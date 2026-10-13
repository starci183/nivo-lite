import "server-only"

import { readScript } from "@/modules/video"
import type { ProjectStatus, ScriptScene } from "@/modules/video"
import { dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"

/** What the authority gate needs to know about a project. */
export interface ProjectBrief {
    /** Project id. */
    readonly id: string
    /** Working title. */
    readonly title: string
    /** Frame shape. */
    readonly aspect: string
    /** Version counter. */
    readonly version: number
    /** Life state as stored. */
    readonly status: ProjectStatus | string
    /** The current render. */
    readonly renderId: string | null
    /** The scenes. */
    readonly script: ReadonlyArray<ScriptScene>
}

/** Reads the facts about a project that the authority gate bases its decision on. */
export const readProjectBrief = async (workspaceId: string, id: string): Promise<DbOutcome<ProjectBrief>> => {
    const client = await createServerDbClient()
    const found = toOutcome(
        await client
            .from("video_projects")
            .select("id, title, aspect, version, status, render_id, script")
            .eq("workspace_id", workspaceId)
            .eq("id", id)
            .maybeSingle(),
    )
    if (found.kind !== "ok") return found
    const row = found.value
    return dbOk({
        id: row.id,
        title: row.title,
        aspect: row.aspect,
        version: row.version,
        status: row.status,
        renderId: row.render_id,
        script: readScript(row.script),
    })
}
