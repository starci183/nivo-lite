import { RENDER_COMPLETED, RENDER_DOOR_PATH, type RenderStatus } from "@modules/domain/video-compose"
import type { SandboxCatalogue, SandboxInboundCase, SandboxInput, SandboxInputField } from "@modules/domain/provider-sandbox"

/*
 * SHOTSTACK'S SANDBOX CATALOGUE (owner ruling R60): fixed named cases `SHOTSTACK-<n>`, identical on every machine. A render is picked by
 * the address of the FIRST CLIP of the spec (its natural key); a clip the catalogue does not name takes the default case SHOTSTACK-1 (a
 * render that completes). A status read walks Shotstack's own states (queued, fetching, rendering, saving) before the end; the webhook
 * body is Shotstack's render callback (`type` "edit", `action` "render", `id`, `owner`, `status`, `url`, `error`, `completed`).
 * The refusal and not-found words are representative: the live adapter carries whatever words Shotstack answered.
 */

/** The provider key of the catalogue. */
export const SHOTSTACK_SANDBOX_PROVIDER = "shotstack"

/**
 * The segment a sandbox webhook path carries where a live one carries the connection's webhook secret. A sandbox account holds no secret:
 * its call is proven by the sandbox key header (`x-nivo-sandbox-key`) the Sandbox page or the test adds, never by this segment.
 */
export const SHOTSTACK_SANDBOX_PATH_TOKEN = "sandbox"

/** The finished video every completing render ends at. */
export const SHOTSTACK_SANDBOX_OUTPUT_URL = "https://sandbox.nivo.test/shotstack/renders/finished.mp4"

/** The reason Shotstack's failed render carries in `error`. */
export const SHOTSTACK_SANDBOX_FAILED_MESSAGE = "Unable to fetch asset: the video source answered 404."

/** Shotstack's words when it refuses an Edit at start (a 400: an answered refusal, `rejected`). */
export const SHOTSTACK_SANDBOX_REJECTED_MESSAGE = "Bad Request: the edit timeline is not valid."

/** Shotstack's words for a render id the account does not hold (a 404). */
export const SHOTSTACK_SANDBOX_NOT_FOUND_MESSAGE = "Not Found"

/** The owner id Shotstack's callback names (fixed). */
export const SHOTSTACK_SANDBOX_OWNER = "sbx-shotstack-owner"

/** The time Shotstack's callback names as completed (fixed). */
export const SHOTSTACK_SANDBOX_COMPLETED_AT = "2026-11-14T00:00:00.000Z"

/** What a start comes to: a render accepted, refused (an answered 4xx: nothing was sent), or sent with an outcome that is unknown (a 5xx). */
export type ShotstackSandboxStartOutcome = "accepted" | "refused" | "unknown"

/** One start case of the table: the clip address that picks it and what happens next. */
export interface ShotstackSandboxStartCase {
    /** The catalogue case id. */
    readonly caseId: string
    /** The address of the first clip that picks the case. */
    readonly clipUrl: string
    /** What the start comes to. */
    readonly outcome: ShotstackSandboxStartOutcome
    /** The statuses successive status reads see (the last one holds); empty for a start that is refused. */
    readonly polls: ReadonlyArray<RenderStatus>
}

/** The first clip address of every named start case. */
export const SHOTSTACK_SANDBOX_CLIPS = {
    completes: "https://sandbox.nivo.test/clips/completes.mp4",
    fails: "https://sandbox.nivo.test/clips/fails.mp4",
    rejected: "https://sandbox.nivo.test/clips/rejected.mp4",
    serverError: "https://sandbox.nivo.test/clips/server-error.mp4",
} as const

/** The start cases by clip address. A status read sees queued, then rendering (fetching, rendering, saving), then the end. */
export const SHOTSTACK_SANDBOX_STARTS: ReadonlyArray<ShotstackSandboxStartCase> = [
    { caseId: "SHOTSTACK-1", clipUrl: SHOTSTACK_SANDBOX_CLIPS.completes, outcome: "accepted", polls: ["queued", "rendering", "rendering", "done"] },
    { caseId: "SHOTSTACK-2", clipUrl: SHOTSTACK_SANDBOX_CLIPS.fails, outcome: "accepted", polls: ["queued", "rendering", "failed"] },
    { caseId: "SHOTSTACK-3", clipUrl: SHOTSTACK_SANDBOX_CLIPS.rejected, outcome: "refused", polls: [] },
    { caseId: "SHOTSTACK-4", clipUrl: SHOTSTACK_SANDBOX_CLIPS.serverError, outcome: "unknown", polls: ["queued", "rendering", "rendering", "done"] },
]

/** The case a start takes when its first clip names none: a render that completes. */
export const SHOTSTACK_SANDBOX_DEFAULT_START: ShotstackSandboxStartCase = {
    caseId: "SHOTSTACK-1",
    clipUrl: "",
    outcome: "accepted",
    polls: ["queued", "rendering", "rendering", "done"],
}

/** The id of the render a sandbox account starts as its start number `seq` + 1: the ids the inbound cases name. */
export const shotstackSandboxRenderId = (seq: number): string => `SBX-SHOTSTACK-${String(seq + 1).padStart(6, "0")}`

/** The path of Shotstack's render webhook on NIVO for one account: the render door of the provider (the sandbox key header proves the call). */
const webhookPath = (connectionId: string): string =>
    `${RENDER_DOOR_PATH}/${SHOTSTACK_SANDBOX_PROVIDER}/${encodeURIComponent(connectionId)}/${SHOTSTACK_SANDBOX_PATH_TOKEN}`

/** The one input of a render webhook case: the id of the render the account started earlier (its start answered it). */
const renderInputs = (example: string): ReadonlyArray<SandboxInputField> => [
    { name: "renderId", label: "Mã render đã tạo / Render id the account started", kind: "text", example },
]

/** The render id an input names, or the case's example when none is given. */
const renderIdOf = (input: SandboxInput, example: string): string => (typeof input.renderId === "string" && input.renderId !== "" ? input.renderId : example)

/** A render webhook case of Shotstack: the body of the render named by the input, built by `bodyOf`. */
const webhookCase = (example: string, bodyOf: (renderId: string) => unknown): SandboxInboundCase => ({
    trigger: RENDER_COMPLETED,
    path: webhookPath,
    inputs: renderInputs(example),
    eventsOf: async (input: SandboxInput) => [{ body: bodyOf(renderIdOf(input, example)) }],
})

/** The hardcoded catalogue of Shotstack's sandbox. */
export const SHOTSTACK_SANDBOX_CATALOGUE: SandboxCatalogue = {
    provider: SHOTSTACK_SANDBOX_PROVIDER,
    cases: [
        {
            id: "SHOTSTACK-1",
            label: "A render is accepted (queued) and later completes: status reads see queued, rendering, then done with its video address",
            operation: "start",
        },
        { id: "SHOTSTACK-2", label: "A render is accepted and later fails: status reads end at failed with Shotstack's reason", operation: "start" },
        { id: "SHOTSTACK-3", label: "An Edit is refused at start (400): rejected, nothing sent", operation: "start" },
        { id: "SHOTSTACK-4", label: "A render start ends in an unknown outcome (5xx): the render exists, the caller cannot know it", operation: "start" },
        { id: "SHOTSTACK-5", label: "A status read of a render the account does not hold: not_found refusal", operation: "statusOf" },
        {
            id: "SHOTSTACK-6",
            label: "The callback reports a render that is done (the render named, by default the first of the account): done with its video address",
            inbound: webhookCase(shotstackSandboxRenderId(0), (id) => ({
                type: "edit",
                action: "render",
                id,
                owner: SHOTSTACK_SANDBOX_OWNER,
                status: "done",
                url: SHOTSTACK_SANDBOX_OUTPUT_URL,
                error: null,
                completed: SHOTSTACK_SANDBOX_COMPLETED_AT,
            })),
        },
        {
            id: "SHOTSTACK-7",
            label: "The callback reports a render that failed (the render named, by default the second of the account): failed with its error",
            inbound: webhookCase(shotstackSandboxRenderId(1), (id) => ({
                type: "edit",
                action: "render",
                id,
                owner: SHOTSTACK_SANDBOX_OWNER,
                status: "failed",
                url: null,
                error: SHOTSTACK_SANDBOX_FAILED_MESSAGE,
                completed: SHOTSTACK_SANDBOX_COMPLETED_AT,
            })),
        },
    ],
}
