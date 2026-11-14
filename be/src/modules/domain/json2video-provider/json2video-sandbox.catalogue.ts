import { RENDER_COMPLETED, RENDER_DOOR_PATH, type RenderStatus } from "@modules/domain/video-compose"
import type { SandboxCatalogue, SandboxInboundCase, SandboxInput, SandboxInputField } from "@modules/domain/provider-sandbox"

/*
 * JSON2VIDEO'S SANDBOX CATALOGUE (owner ruling R60): fixed named cases `JSON2VIDEO-<n>`, identical on every machine. A render (a movie) is
 * picked by the address of the FIRST CLIP of the spec (its natural key); a clip the catalogue does not name takes the default case
 * JSON2VIDEO-1 (a render that completes). A status read walks JSON2Video's own states (pending, running, then done or error); the
 * webhook body is JSON2Video's flat one (no event name: `success`, `project`, then `url` or `error`). The refusal and not-found words
 * are representative: the live adapter carries whatever words JSON2Video answered.
 */

/** The provider key of the catalogue. */
export const JSON2VIDEO_SANDBOX_PROVIDER = "json2video"

/**
 * The segment a sandbox webhook path carries where a live one carries the connection's webhook secret. A sandbox account holds no secret:
 * its call is proven by the sandbox key header (`x-nivo-sandbox-key`) the Sandbox page or the test adds, never by this segment.
 */
export const JSON2VIDEO_SANDBOX_PATH_TOKEN = "sandbox"

/** The finished video every completing render ends at. */
export const JSON2VIDEO_SANDBOX_OUTPUT_URL = "https://sandbox.nivo.test/json2video/renders/finished.mp4"

/** The words JSON2Video's failed render carries (`message` of its status read, `error` of its webhook). */
export const JSON2VIDEO_SANDBOX_FAILED_MESSAGE = "A video source could not be downloaded."

/** JSON2Video's words when an account is out of credits (a 402: an answered refusal, `rejected`). */
export const JSON2VIDEO_SANDBOX_NO_CREDITS_MESSAGE = "Not enough credits to render this movie."

/** JSON2Video's words for a project the account does not hold (a 404). */
export const JSON2VIDEO_SANDBOX_NOT_FOUND_MESSAGE = "Project not found."

/** What a start comes to: a render accepted, refused (an answered 4xx: nothing was sent), or sent with an outcome that is unknown (a 5xx). */
export type Json2VideoSandboxStartOutcome = "accepted" | "refused" | "unknown"

/** One start case of the table: the clip address that picks it and what happens next. */
export interface Json2VideoSandboxStartCase {
    /** The catalogue case id. */
    readonly caseId: string
    /** The address of the first clip that picks the case. */
    readonly clipUrl: string
    /** What the start comes to. */
    readonly outcome: Json2VideoSandboxStartOutcome
    /** The statuses successive status reads see (the last one holds); empty for a start that is refused. */
    readonly polls: ReadonlyArray<RenderStatus>
}

/** The first clip address of every named start case. */
export const JSON2VIDEO_SANDBOX_CLIPS = {
    completes: "https://sandbox.nivo.test/clips/completes.mp4",
    fails: "https://sandbox.nivo.test/clips/fails.mp4",
    noCredits: "https://sandbox.nivo.test/clips/no-credits.mp4",
    serverError: "https://sandbox.nivo.test/clips/server-error.mp4",
} as const

/** The start cases by clip address. A status read sees queued (pending), then rendering (running), then the end. */
export const JSON2VIDEO_SANDBOX_STARTS: ReadonlyArray<Json2VideoSandboxStartCase> = [
    { caseId: "JSON2VIDEO-1", clipUrl: JSON2VIDEO_SANDBOX_CLIPS.completes, outcome: "accepted", polls: ["queued", "rendering", "done"] },
    { caseId: "JSON2VIDEO-2", clipUrl: JSON2VIDEO_SANDBOX_CLIPS.fails, outcome: "accepted", polls: ["queued", "rendering", "failed"] },
    { caseId: "JSON2VIDEO-3", clipUrl: JSON2VIDEO_SANDBOX_CLIPS.noCredits, outcome: "refused", polls: [] },
    { caseId: "JSON2VIDEO-4", clipUrl: JSON2VIDEO_SANDBOX_CLIPS.serverError, outcome: "unknown", polls: ["queued", "rendering", "done"] },
]

/** The case a start takes when its first clip names none: a render that completes. */
export const JSON2VIDEO_SANDBOX_DEFAULT_START: Json2VideoSandboxStartCase = {
    caseId: "JSON2VIDEO-1",
    clipUrl: "",
    outcome: "accepted",
    polls: ["queued", "rendering", "done"],
}

/** The id (JSON2Video's `project`) of the render a sandbox account starts as its start number `seq` + 1: the ids the inbound cases name. */
export const json2videoSandboxRenderId = (seq: number): string => `SBX-JSON2VIDEO-${String(seq + 1).padStart(6, "0")}`

/** The path of JSON2Video's render webhook on NIVO for one account: the render door of the provider (the sandbox key header proves the call). */
const webhookPath = (connectionId: string): string =>
    `${RENDER_DOOR_PATH}/${JSON2VIDEO_SANDBOX_PROVIDER}/${encodeURIComponent(connectionId)}/${JSON2VIDEO_SANDBOX_PATH_TOKEN}`

/** The one input of a render webhook case: the id of the render the account started earlier (its start answered it). */
const renderInputs = (example: string): ReadonlyArray<SandboxInputField> => [
    { name: "renderId", label: "Mã render đã tạo / Render id the account started", kind: "text", example },
]

/** The render id an input names, or the case's example when none is given. */
const renderIdOf = (input: SandboxInput, example: string): string => (typeof input.renderId === "string" && input.renderId !== "" ? input.renderId : example)

/** A render webhook case of JSON2Video: the body of the render named by the input, built by `bodyOf`. */
const webhookCase = (example: string, bodyOf: (renderId: string) => unknown): SandboxInboundCase => ({
    trigger: RENDER_COMPLETED,
    path: webhookPath,
    inputs: renderInputs(example),
    eventsOf: async (input: SandboxInput) => [{ body: bodyOf(renderIdOf(input, example)) }],
})

/** The hardcoded catalogue of JSON2Video's sandbox. */
export const JSON2VIDEO_SANDBOX_CATALOGUE: SandboxCatalogue = {
    provider: JSON2VIDEO_SANDBOX_PROVIDER,
    cases: [
        {
            id: "JSON2VIDEO-1",
            label: "A render is accepted (pending) and later completes: status reads see pending, running, then done with its video address",
            operation: "start",
        },
        { id: "JSON2VIDEO-2", label: "A render is accepted and later fails: status reads end at error with its message", operation: "start" },
        { id: "JSON2VIDEO-3", label: "A render is refused at start for no credits (402): rejected, nothing sent", operation: "start" },
        { id: "JSON2VIDEO-4", label: "A render start ends in an unknown outcome (5xx): the render exists, the caller cannot know it", operation: "start" },
        { id: "JSON2VIDEO-5", label: "A status read of a render the account does not hold: not_found refusal", operation: "statusOf" },
        {
            id: "JSON2VIDEO-6",
            label: "The webhook reports a render that succeeded (the project named, by default the first render of the account): done with its video address",
            inbound: webhookCase(json2videoSandboxRenderId(0), (project) => ({ success: true, project, url: JSON2VIDEO_SANDBOX_OUTPUT_URL })),
        },
        {
            id: "JSON2VIDEO-7",
            label: "The webhook reports a render that failed (the project named, by default the second render of the account): failed with its error",
            inbound: webhookCase(json2videoSandboxRenderId(1), (project) => ({ success: false, project, error: JSON2VIDEO_SANDBOX_FAILED_MESSAGE })),
        },
        {
            id: "JSON2VIDEO-8",
            label: "The dashboard's test ping (no finished render): the door keeps nothing",
            inbound: {
                trigger: RENDER_COMPLETED,
                path: webhookPath,
                inputs: [],
                eventsOf: async () => [{ body: { test: true, success: true, project: json2videoSandboxRenderId(0), url: JSON2VIDEO_SANDBOX_OUTPUT_URL } }],
            },
        },
    ],
}
