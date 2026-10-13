"use server"

import { apiRequest } from "../request"
import type { Outcome } from "../outcome"

/** What the back end answers when a render is queued. */
interface RenderQueuedWire {
    readonly renderId: string
    readonly projectId: string
}

/** Asks the back end to render a project; it builds the spec, validates it, marks the project rendering and queues the job. */
export const writeRenderVideo = async (projectId: string): Promise<Outcome<RenderQueuedWire>> =>
    apiRequest<RenderQueuedWire>("/video/renders", { method: "POST", body: { projectId } })
