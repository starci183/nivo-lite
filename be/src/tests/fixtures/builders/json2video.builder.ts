/*
 * JSON2Video fixtures: JSON copied from the vendor's official documentation (short excerpts, the page above each). No live call, no
 * recorded traffic. The hostnames and ids are the docs' own placeholders.
 */

/** A JSON document of the docs. */
export type J2vFixture = Readonly<Record<string, unknown>>

/** The synchronous error body of the docs: `{ success, message, code? }`. */
export interface J2vError {
    /** Always false. */
    readonly success: boolean
    /** The provider's words. */
    readonly message: string
    /** The provider's code word, on some errors. */
    readonly code?: string
}

/** A project id as the docs print it (movies-status example). */
export const J2V_PROJECT: string = "JkGxEoPRF9EgRb32"

/** The key of a test connection: assembled, never a real value. */
export const J2V_KEY: string = ["test", "key"].join("-")

/** The video address of the docs' `done` example. */
export const J2V_URL: string = "https://assets.json2video.com/clients/xxxxxxxx/renders/2026-05-12-36066.mp4"

// https://json2video.com/docs/v2/reference/api-endpoints/movies-create (200: `success`, `project`, `timestamp`)
export const J2V_CREATED: J2vFixture = { success: true, project: J2V_PROJECT, timestamp: "2026-05-12T07:41:41.946Z" }

// https://json2video.com/docs/v2/reference/api-endpoints/movies-status (200 single project, status "done")
export const J2V_STATUS_DONE: J2vFixture = {
    success: true,
    movie: {
        success: true,
        status: "done",
        message: "",
        project: J2V_PROJECT,
        url: J2V_URL,
        thumbnail: "https://assets.json2video.com/clients/xxxxxxxx/renders/2026-05-12-36066.jpg",
        audio_url: null,
        ass: "https://assets.json2video.com/clients/xxxxxxxx/renders/2026-05-12-36066.ass",
        created_at: "2026-05-12T07:41:41.946Z",
        ended_at: "2026-05-12T07:44:57.108Z",
        duration: 108.2,
        size: 6876189,
        width: 1080,
        height: 1920,
        rendering_time: 195,
        "client-data": {},
        consumed_credits: [],
    },
    remaining_quota: { movies: 0, drafts: 0, time: 1807 },
}

// https://json2video.com/docs/v2/reference/api-endpoints/movies-status ("Movie object fields": status pending, running, error with `message`)
export const J2V_STATUS_PENDING: J2vFixture = {
    success: true,
    movie: { success: false, status: "pending", message: "", project: J2V_PROJECT, url: null, created_at: "2026-05-12T07:41:41.946Z", ended_at: null },
}
export const J2V_STATUS_RUNNING: J2vFixture = {
    success: true,
    movie: { success: false, status: "running", message: "", project: J2V_PROJECT, url: null, created_at: "2026-05-12T07:41:41.946Z", ended_at: null },
}
// the failure message is the one the webhooks page prints for a failed render
export const J2V_STATUS_ERROR: J2vFixture = {
    success: true,
    movie: {
        success: false,
        status: "error",
        message: "Scene #1, element #2: \u2026",
        project: J2V_PROJECT,
        url: null,
        created_at: "2026-05-12T07:41:41.946Z",
        ended_at: "2026-05-12T07:42:10.000Z",
    },
}

// https://json2video.com/docs/v2/reference/errors (synchronous error body `{ success, message, code? }`; the `message` of the coded one is
// illustrative words, the `code` value is one the page lists)
export const J2V_ERROR_BODY: J2vError = { success: false, message: "Error: Invalid API Key" }
export const J2V_ERROR_CODED: J2vError = { success: false, message: "Movie JSON is over 2 MB.", code: "movie_json_too_large" }

// https://json2video.com/docs/v2/reference/webhooks (inline webhook destination in the movie JSON)
export const J2V_WEBHOOK_EXPORTS: ReadonlyArray<J2vFixture> = [{ destinations: [{ type: "webhook", endpoint: "https://example.com/webhook" }] }]

// https://json2video.com/docs/v2/reference/webhooks (success payload)
export const J2V_HOOK_SUCCESS: J2vFixture = {
    width: 1920,
    height: 1080,
    codec: "h264",
    codec_type: "video",
    pix_fmt: "yuv420p",
    duration: 10.5,
    size: 4567890,
    video_streams: 1,
    audio_streams: 1,
    frame_rate: 25,
    color_transfer: null,
    color_primaries: null,
    color_space: null,
    url: "https://assets.json2video.com/clients/xxxxxxxx/renders/yourmovie.mp4",
    thumbnail: "https://assets.json2video.com/clients/xxxxxxxx/renders/yourmovie.jpg",
    success: true,
    project: J2V_PROJECT,
    id: "your-movie-id",
    "client-data": { order_id: "ord_42" },
}

// https://json2video.com/docs/v2/reference/webhooks (failure payload)
export const J2V_HOOK_FAILURE: J2vFixture = {
    success: false,
    error: "Scene #1, element #2: \u2026",
    project: J2V_PROJECT,
    id: "your-movie-id",
    "client-data": { order_id: "ord_42" },
}

// https://json2video.com/docs/v2/reference/webhooks (the dashboard's Test button: a success-shaped payload with fake values and `"test": true`)
export const J2V_HOOK_TEST: J2vFixture = { ...J2V_HOOK_SUCCESS, test: true }
