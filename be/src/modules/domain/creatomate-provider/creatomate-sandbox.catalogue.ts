import { RENDER_COMPLETED, RENDER_DOOR_PATH, type RenderStatus } from "@modules/domain/video-compose"
import type { SandboxCatalogue, SandboxInboundCase, SandboxInput, SandboxInputField } from "@modules/domain/provider-sandbox"

/*
 * CREATOMATE'S SANDBOX CATALOGUE (owner ruling R60): fixed named cases `CREATOMATE-<n>`, identical on every machine. A render is
 * picked by the address of the FIRST CLIP of the spec (its natural key); a clip the catalogue does not name takes the default case
 * CREATOMATE-1 (a render that completes). The shapes of the answers are Creatomate's own: a render object (`id`, `status`, `url`,
 * `error_message`) is what a start, a status read and the webhook share.
 */

/** The provider key of the catalogue. */
export const CREATOMATE_SANDBOX_PROVIDER = "creatomate"

/**
 * The segment a sandbox webhook path carries where a live one carries the connection's webhook secret. A sandbox account holds no secret:
 * its call is proven by the sandbox key header (`x-nivo-sandbox-key`) the Sandbox page or the test adds, never by this segment.
 */
export const CREATOMATE_SANDBOX_PATH_TOKEN = "sandbox"

/** The finished video every completing render ends at. */
export const CREATOMATE_SANDBOX_OUTPUT_URL = "https://sandbox.nivo.test/creatomate/renders/finished.mp4"

/** The words Creatomate's failed render carries in `error_message`. */
export const CREATOMATE_SANDBOX_FAILED_MESSAGE = "An element source could not be downloaded."

/** Creatomate's hint when an account is out of credits (a 402: an answered refusal, `rejected`). */
export const CREATOMATE_SANDBOX_NO_CREDITS_HINT = "Your account has run out of credits."

/** Creatomate's hint for a render id the account does not hold (a 404). */
export const CREATOMATE_SANDBOX_NOT_FOUND_HINT = "Render not found."

/** What a start comes to: a render accepted, refused (an answered 4xx: nothing was sent), or sent with an outcome that is unknown (a 5xx). */
export type CreatomateSandboxStartOutcome = "accepted" | "refused" | "unknown"

/** One start case of the table: the clip address that picks it and what happens next. */
export interface CreatomateSandboxStartCase {
    /** The catalogue case id. */
    readonly caseId: string
    /** The address of the first clip that picks the case. */
    readonly clipUrl: string
    /** What the start comes to. */
    readonly outcome: CreatomateSandboxStartOutcome
    /** The statuses successive status reads see (the last one holds); empty for a start that is refused. */
    readonly polls: ReadonlyArray<RenderStatus>
}

/** The first clip address of every named start case. */
export const CREATOMATE_SANDBOX_CLIPS = {
    completes: "https://sandbox.nivo.test/clips/completes.mp4",
    fails: "https://sandbox.nivo.test/clips/fails.mp4",
    noCredits: "https://sandbox.nivo.test/clips/no-credits.mp4",
    serverError: "https://sandbox.nivo.test/clips/server-error.mp4",
} as const

/** The start cases by clip address. A status read sees queued (planned), then rendering, then the end. */
export const CREATOMATE_SANDBOX_STARTS: ReadonlyArray<CreatomateSandboxStartCase> = [
    { caseId: "CREATOMATE-1", clipUrl: CREATOMATE_SANDBOX_CLIPS.completes, outcome: "accepted", polls: ["queued", "rendering", "done"] },
    { caseId: "CREATOMATE-2", clipUrl: CREATOMATE_SANDBOX_CLIPS.fails, outcome: "accepted", polls: ["queued", "rendering", "failed"] },
    { caseId: "CREATOMATE-3", clipUrl: CREATOMATE_SANDBOX_CLIPS.noCredits, outcome: "refused", polls: [] },
    { caseId: "CREATOMATE-4", clipUrl: CREATOMATE_SANDBOX_CLIPS.serverError, outcome: "unknown", polls: ["queued", "rendering", "done"] },
]

/** The case a start takes when its first clip names none: a render that completes. */
export const CREATOMATE_SANDBOX_DEFAULT_START: CreatomateSandboxStartCase = {
    caseId: "CREATOMATE-1",
    clipUrl: "",
    outcome: "accepted",
    polls: ["queued", "rendering", "done"],
}

/** The id of the render a sandbox account starts as its start number `seq` + 1: the ids the inbound cases name. */
export const creatomateSandboxRenderId = (seq: number): string => `SBX-CREATOMATE-${String(seq + 1).padStart(6, "0")}`

/** The path of Creatomate's render webhook on NIVO for one account: the render door of the provider (the sandbox key header proves the call). */
const webhookPath = (connectionId: string): string =>
    `${RENDER_DOOR_PATH}/${CREATOMATE_SANDBOX_PROVIDER}/${encodeURIComponent(connectionId)}/${CREATOMATE_SANDBOX_PATH_TOKEN}`

/** The one input of a render webhook case: the id of the render the account started earlier (its start answered it). */
const renderInputs = (example: string): ReadonlyArray<SandboxInputField> => [
    { name: "renderId", label: "Mã render đã tạo / Render id the account started", kind: "text", example },
]

/** The render id an input names, or the case's example when none is given. */
const renderIdOf = (input: SandboxInput, example: string): string => (typeof input.renderId === "string" && input.renderId !== "" ? input.renderId : example)

/** A render webhook case of Creatomate: the body of the render named by the input, built by `bodyOf`. */
const webhookCase = (example: string, bodyOf: (renderId: string) => unknown): SandboxInboundCase => ({
    trigger: RENDER_COMPLETED,
    path: webhookPath,
    inputs: renderInputs(example),
    eventsOf: async (input: SandboxInput) => [{ body: bodyOf(renderIdOf(input, example)) }],
})

/** The hardcoded catalogue of Creatomate's sandbox. */
export const CREATOMATE_SANDBOX_CATALOGUE: SandboxCatalogue = {
    provider: CREATOMATE_SANDBOX_PROVIDER,
    cases: [
        {
            id: "CREATOMATE-1",
            label: "A render is accepted (planned) and later completes: status reads see planned, rendering, then succeeded with its video address",
            operation: "start",
        },
        { id: "CREATOMATE-2", label: "A render is accepted and later fails: status reads end at failed with its error_message", operation: "start" },
        { id: "CREATOMATE-3", label: "A render is refused at start for no credits (402): rejected, nothing sent", operation: "start" },
        { id: "CREATOMATE-4", label: "A render start ends in an unknown outcome (5xx): the render exists, the caller cannot know it", operation: "start" },
        { id: "CREATOMATE-5", label: "A status read of a render the account does not hold: not_found refusal", operation: "statusOf" },
        {
            id: "CREATOMATE-6",
            label: "The webhook reports a render that succeeded (the render id named, by default the first of the account): done with its video address",
            inbound: webhookCase(creatomateSandboxRenderId(0), (id) => ({ id, status: "succeeded", url: CREATOMATE_SANDBOX_OUTPUT_URL, error_message: null })),
        },
        {
            id: "CREATOMATE-7",
            label: "The webhook reports a render that failed (the render id named, by default the second of the account): failed with its error_message",
            inbound: webhookCase(creatomateSandboxRenderId(1), (id) => ({ id, status: "failed", url: null, error_message: CREATOMATE_SANDBOX_FAILED_MESSAGE })),
        },
    ],
}
