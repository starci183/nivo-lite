"use server"
import "server-only"

import { awaitCommand } from "../commands/read-command"
import { getPrincipal } from "../principal"
import { dbFailure, dbOk } from "../outcome"
import type { DbOutcome } from "../outcome"
import { rpcFailure } from "../rpc-failure"
import { createServerDbClient } from "../server"
import { renderProjectSchema } from "./video.mapper"

/** What the back end answers when a render is queued. */
export interface RenderQueuedItem {
    readonly renderId: string
    readonly projectId: string
}

/**
 * Asks the back end to render a project: the database function proves the caller is an owner or manager and queues the request; the job
 * builds the spec, validates it, marks the project rendering and queues the render. Waits for the job to settle the command.
 */
export const writeRenderVideo = async (projectId: string): Promise<DbOutcome<RenderQueuedItem>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = renderProjectSchema.safeParse(projectId)
    if (!parsed.success) return dbFailure("invalid", "render-input")
    const client = await createServerDbClient()
    const { data, error } = await client.rpc("request_video_render", { p_project: parsed.data })
    if (error !== null) return rpcFailure(error)
    const answer = await awaitCommand(data)
    if (answer.kind !== "ok") return answer
    const { renderId, projectId: queuedProject } = answer.value
    return typeof renderId === "string" && typeof queuedProject === "string"
        ? dbOk({ renderId, projectId: queuedProject })
        : dbFailure("unavailable", "render-shape")
}
