import "server-only"

import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"

/** What the authority gate learns about an approved video. */
export interface ApprovedVideo {
    /** The project title. */
    readonly title: string
    /** The render that was approved. */
    readonly renderId: string | null
}

/**
 * The effect of the owner's approval through the authority gate: a rendered video becomes approved (download and share unlock).
 * Not a server action on purpose: only the gate's performer may call it, never a browser.
 */
export const markVideoApproved = async (
    workspaceId: string,
    projectId: string,
    by: string,
): Promise<DbOutcome<ApprovedVideo>> => {
    const client = await createServerDbClient()
    const found = toOutcome(
        await client
            .from("video_projects")
            .select("title, status, render_id")
            .eq("workspace_id", workspaceId)
            .eq("id", projectId)
            .maybeSingle(),
    )
    if (found.kind !== "ok") return found
    const project = found.value
    if (!["ready", "approved", "published"].includes(project.status)) return dbFailure("invalid", "not-rendered")
    if (project.render_id === null) return dbFailure("invalid", "no-render")
    const render = toOutcome(
        await client.from("video_renders").select("status").eq("id", project.render_id).maybeSingle(),
    )
    if (render.kind !== "ok" || render.value.status !== "done") return dbFailure("invalid", "render-not-done")
    if (project.status === "ready") {
        const approved = toOutcome(
            await client
                .from("video_projects")
                .update({ status: "approved", approved_at: new Date().toISOString(), approved_by_name: by })
                .eq("workspace_id", workspaceId)
                .eq("id", projectId)
                .eq("status", "ready")
                .select("id")
                .maybeSingle(),
        )
        if (approved.kind !== "ok") return approved
    }
    return dbOk({ title: project.title, renderId: project.render_id })
}
