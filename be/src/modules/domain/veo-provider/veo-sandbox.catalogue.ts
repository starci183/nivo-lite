import type { SandboxCatalogue } from "@modules/domain/provider-sandbox"

/*
 * VEO'S SANDBOX CATALOGUE (owner ruling R60): fixed named cases `VEO-<n>`, identical on every machine, for the two ports Veo registers:
 * video generation (a long-running operation started, then POLLED: Veo sends no webhook to NIVO, so the catalogue has no inbound case)
 * and the files it holds (a generated video reopened by its URI). A generation picks its case by its PROMPT (the natural key); a prompt
 * the catalogue does not name takes the first case (a video that completes). The refusal words are representative: the live adapter
 * carries whatever words Google answered.
 */

/** The provider key of the catalogue. */
export const VEO_SANDBOX_PROVIDER = "veo"

/** What a start comes to: a generation accepted, refused (an answered 4xx: nothing was sent), or sent with an outcome that is unknown (a 5xx). */
export type VeoSandboxStartOutcome = "accepted" | "refused" | "unknown"

/** What a finished generation holds: its video, an error, or nothing (blocked by the provider's filters). */
export type VeoSandboxEnd = "video" | "error" | "blocked"

/** One start case of the table: the prompt that picks it and what comes of it. */
export interface VeoSandboxCase {
    /** The catalogue case id. */
    readonly caseId: string
    /** The prompt that picks the case. */
    readonly prompt: string
    /** What the start comes to. */
    readonly outcome: VeoSandboxStartOutcome
    /** How a generation that was accepted ends. */
    readonly end: VeoSandboxEnd
}

/** The prompts of the named cases. */
export const VEO_SANDBOX_PROMPTS = {
    completes: "sandbox: a video that completes",
    fails: "sandbox: a video that fails",
    blocked: "sandbox: a video the filters block",
    refused: "sandbox: a prompt that is refused",
    serverError: "sandbox: a start that ends in a server error",
} as const

/** The start cases by prompt; a prompt the catalogue does not name takes the first. */
export const VEO_SANDBOX_CASES: ReadonlyArray<VeoSandboxCase> = [
    { caseId: "VEO-1", prompt: VEO_SANDBOX_PROMPTS.completes, outcome: "accepted", end: "video" },
    { caseId: "VEO-2", prompt: VEO_SANDBOX_PROMPTS.fails, outcome: "accepted", end: "error" },
    { caseId: "VEO-3", prompt: VEO_SANDBOX_PROMPTS.blocked, outcome: "accepted", end: "blocked" },
    { caseId: "VEO-4", prompt: VEO_SANDBOX_PROMPTS.refused, outcome: "refused", end: "video" },
    { caseId: "VEO-5", prompt: VEO_SANDBOX_PROMPTS.serverError, outcome: "unknown", end: "video" },
]

/** How many status reads a running generation takes before it ends (it is not done on the first N reads). */
export const VEO_SANDBOX_PENDING_READS = 2

/** The error a failed generation ends with: Google's code and words. */
export const VEO_SANDBOX_FAILED_ERROR: { readonly code: number; readonly message: string } = {
    code: 3,
    message: "The prompt could not be processed.",
}

/** Google's words when a prompt is refused at start (a 400: `rejected`). */
export const VEO_SANDBOX_REJECTED_MESSAGE = "Invalid prompt."

/** Google's words for an operation the account does not hold (a 404). */
export const VEO_SANDBOX_JOB_NOT_FOUND_MESSAGE = "Operation not found."

/** Google's words for a video file the account was never answered (a 404). */
export const VEO_SANDBOX_FILE_NOT_FOUND_MESSAGE = "File not found."

/** The words a start with no model (neither the request's nor the account's) is refused with, as the live adapter does. */
export const VEO_SANDBOX_NO_MODEL_DETAIL = "model"

/** The media type of every generated video. */
export const VEO_SANDBOX_VIDEO_MIME = "video/mp4"

/** The name of an operation a sandbox account starts as its start number `seq` + 1, on one model. */
export const veoSandboxJobName = (model: string, seq: number): string => `models/${model}/operations/SBX-VEO-${String(seq + 1).padStart(6, "0")}`

/** The URI of the video a job (by its operation name) generated. */
export const veoSandboxVideoUri = (jobName: string): string => `https://sandbox.nivo.test/veo/files/${jobName.slice(jobName.lastIndexOf("/") + 1)}.mp4`

/** The bytes of a generated video: fixed, naming its URI. */
export const veoSandboxVideoBytesOf = (uri: string): Buffer => Buffer.from(`SBX-VIDEO|${uri}`, "utf8")

/** The hardcoded catalogue of Veo's sandbox. */
export const VEO_SANDBOX_CATALOGUE: SandboxCatalogue = {
    provider: VEO_SANDBOX_PROVIDER,
    cases: [
        { id: "VEO-1", label: "A generation is accepted and later completes: reads see pending twice, then done with one video", operation: "start" },
        { id: "VEO-2", label: "A generation is accepted and later fails: the read ends failed with Google's code and words", operation: "start" },
        { id: "VEO-3", label: "A generation is accepted and ends done with no video (blocked by the provider's filters)", operation: "start" },
        { id: "VEO-4", label: "A prompt is refused at start (400): rejected, nothing sent", operation: "start" },
        { id: "VEO-5", label: "A generation start ends in an unknown outcome (5xx): the operation exists, the caller cannot know it", operation: "start" },
        { id: "VEO-6", label: "A start naming no model (neither the request's nor the account's meta.model): rejected, nothing sent", operation: "start" },
        { id: "VEO-7", label: "A read of an operation the account does not hold: not_found refusal", operation: "get" },
        { id: "VEO-8", label: "A video reopened by its URI after a read answered it: fixed bytes (video/mp4)", operation: "file" },
        { id: "VEO-9", label: "A video URI no read of the account answered: not_found refusal", operation: "file" },
    ],
}
