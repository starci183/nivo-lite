import type { ConnectionRecord } from "@modules/domain/connections"

/*
 * Shotstack's own JSON, copied from its official documentation (short excerpts). No live call, no recorded traffic.
 */

/** A Shotstack account; `environment` is its public fact (`stage` or `v1`). */
export const shotstackAccountOf = (environment: string | null = "stage"): ConnectionRecord =>
    ({
        id: "5b8f3c2e-7a41-4d6e-9c10-2f4e8a6b1d33",
        workspaceId: "ws-1",
        provider: "shotstack",
        name: "Shotstack",
        meta: environment === null ? {} : { environment },
    }) as unknown as ConnectionRecord

/** A render id as the docs show it. */
export const SHOTSTACK_RENDER_ID = "2abd5c11-0f3d-4c6d-ba20-235fc9b8e8b7"

// https://shotstack.io/docs/api/ (POST /render, 201 "The queued render details")
export const SHOTSTACK_QUEUED = {
    success: true,
    message: "Created",
    response: { message: "Render Successfully Queued", id: "2abd5c11-0f3d-4c6d-ba20-235fc9b8e8b7" },
}

// https://shotstack.io/docs/guide/getting-started/core-concepts/ (a video clip with `trim`, `start`, `length`; `output.format`)
export const SHOTSTACK_DOC_EDIT = {
    timeline: {
        tracks: [{ clips: [{ asset: { type: "video", src: "https://example.test/video.mp4", trim: 2 }, start: 4, length: 6 }] }],
    },
    output: { format: "mp4" },
}

/** The status envelope of GET /render/{id}: https://shotstack.io/docs/api/ (RenderResponse: `success`, `message` "OK", `response.status`, `response.url`, `response.error`). */
export const shotstackStatusBody = (status: string, extra: Record<string, unknown> = {}): unknown => ({
    success: true,
    message: "OK",
    response: { id: SHOTSTACK_RENDER_ID, owner: "5ca6hu7s9k", status, ...extra },
})

// https://shotstack.io/docs/guide/architecting-an-application/webhooks/ (the callback example: status done)
export const SHOTSTACK_WEBHOOK_DONE = {
    type: "edit",
    action: "render",
    id: "6d7acbe6-e7c1-4cf8-b8ea-94e7522878cc",
    owner: "5ca6hu7s9k",
    status: "done",
    url: "https://shotstack-api-v1-output.s3-ap-southeast-2.amazonaws.com/5ca6hu7s9k/6d7acbe6-e7c1-4cf8-b8ea-94e7522878cc.mp4",
    error: null,
    completed: "2020-02-24T11:52:20.810Z",
}

// https://shotstack.io/docs/guide/architecting-an-application/webhooks/ (a failed render keeps the same members; "an error reason will be provided against the error parameter"; the reason text below is our own example, the docs print none)
export const SHOTSTACK_WEBHOOK_FAILED = {
    ...SHOTSTACK_WEBHOOK_DONE,
    status: "failed",
    url: null,
    error: "Unable to fetch the video asset.",
}
