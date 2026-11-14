/*
 * Creatomate fixtures: JSON copied from the official docs (short excerpts), each with its URL above it. No live call, no recorded
 * traffic. Where the docs show no example (the webhook body, a failed render), the body is built from the field description and says so.
 */

/** An account of Creatomate (no secret in the record: the key lives in the sealed secret). */
export const CREATOMATE_ACCOUNT_ID = "4f0c2a8e-0d4b-4c43-9a51-0c7a8a5a0c77"

/** A render's id as the docs print one. */
export const CREATOMATE_RENDER_ID = "a862048b-d0dc-4029-a4ef-e172e8ded827"

// https://creatomate.com/docs/api/reference/create-a-render  (Response: 202 Accepted; `status` starts at `planned`)
export const CREATOMATE_STARTED = {
    id: "a862048b-d0dc-4029-a4ef-e172e8ded827",
    status: "planned",
    url: "https://cdn.creatomate.com/renders/a862048b-d0dc-4029-a4ef-e172e8ded827.mp4",
    template_id: "YOUR_TEMPLATE_ID",
    output_format: "mp4",
    render_scale: 0.75,
    webhook_url: "https://example.com/webhook",
    metadata: "Any text value",
}

// https://creatomate.com/docs/api/reference/get-the-status-of-a-render  (Response example)
export const CREATOMATE_SUCCEEDED = {
    id: "a862048b-d0dc-4029-a4ef-e172e8ded827",
    status: "succeeded",
    url: "https://cdn.creatomate.com/renders/a862048b-d0dc-4029-a4ef-e172e8ded827.mp4",
    snapshot_url: "https://cdn.creatomate.com/snapshots/a862048b-d0dc-4029-a4ef-e172e8ded827.jpg",
    output_format: "mp4",
    render_scale: 1,
    width: 1280,
    height: 720,
    frame_rate: 60,
    duration: 3,
    file_size: 10804,
}

// https://creatomate.com/docs/api/reference/what-is-a-render  (statuses `rendering` and `failed`, field `error_message`: the docs give no
// example object, so these two are the get-status example with the status word and the field the page describes)
export const CREATOMATE_RENDERING = { ...CREATOMATE_STARTED, status: "rendering" }
export const CREATOMATE_FAILED = {
    id: "a862048b-d0dc-4029-a4ef-e172e8ded827",
    status: "failed",
    error_message: "An asset could not be loaded (404).",
}

// https://creatomate.com/docs/api/reference/set-up-a-webhook  ("the data follows the format in What is a Render"; no example body is
// printed, so the webhook bodies below are the render objects above)
export const CREATOMATE_WEBHOOK_DONE = CREATOMATE_SUCCEEDED
export const CREATOMATE_WEBHOOK_FAILED = CREATOMATE_FAILED

// https://creatomate.com/docs/api/reference/introduction  (errors: a JSON body with `hint`, and `documentation` except for 402; the docs
// print no example body, so the hint WORDS here are made up for the shape only)
export const CREATOMATE_ERROR_400 = {
    hint: "The value of width must be a number between 0 and 3840.",
    documentation: "https://creatomate.com/docs/api/reference/introduction",
}
export const CREATOMATE_ERROR_402 = { hint: "You have run out of credits." }
