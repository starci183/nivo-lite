/** The queue name: the contract between `public.request_video_render` and the processor of the request-render job (a pgmq queue name). */
export const RENDER_REQUEST_QUEUE = "render_request"

/** The payload of one render request: the row of `public.app_commands` that holds what was asked. */
export interface RenderRequestPayload {
    /** The `app_commands` row to serve. */
    readonly commandId: string
}

/** A render request read from a job payload; null when the payload names no command and the job is dropped. */
export type OptionalRenderRequestPayload = RenderRequestPayload | null

/** Reads a job payload as a render request; null when it names no command. */
export const renderRequestPayloadOf = (value: object): OptionalRenderRequestPayload =>
    "commandId" in value && typeof value.commandId === "string" ? { commandId: value.commandId } : null
