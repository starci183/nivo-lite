import type { ConnectionRecord } from "@modules/domain/connections"

/**
 * THE GENERIC MEDIA PURPOSES a provider may serve (speech, dubbing, video generation), named by what they do, never by a provider. A
 * provider module implements a port and registers it under its provider key; the native media tools look a port up by the provider of
 * the account the tool runner handed the call and never name a provider. A failure is thrown with what it proves (`withProof`): a
 * refusal the provider answered (`providerRefusal` (a `ProviderRegistryError`)) proves no effect.
 */

/**
 * A binary result a provider holds (an audio clip, a dubbed track, a generated video), behind its handle. The engine stores no bytes
 * here: the generic file store (G3) takes a `ProviderFile` and keeps it; until then a tool answers the handle (`ProviderFileRef`) and a
 * later read opens it again through the provider's `ProviderFileReader`.
 */
export interface ProviderFile {
    /** The provider key that holds it. */
    readonly provider: string
    /** The provider's own handle of the file: what `ProviderFileReader.open` takes back (a job and language, a file URI). */
    readonly handle: string
    /** The media type the provider declared or the request asked, or null when it said none. */
    readonly mimeType: string | null
    /** When the provider removes it (ISO 8601), or null when it says none. */
    readonly expiresAt: string | null
    /** Reads the bytes from the provider (or from memory for a result the provider answered in the call itself). */
    fetch(): Promise<Buffer>
}

/**
 * The JSON reference a generic tool answers for a `ProviderFile`: everything needed to open it again on the same account, no bytes.
 * `stored` is the generic file store's id once G3 kept it, null until then.
 */
export interface ProviderFileRef {
    /** The provider key that holds it. */
    readonly provider: string
    /** The connected account it was made on. */
    readonly connectionId: string
    /** The provider's handle. */
    readonly handle: string
    /** The media type, or null. */
    readonly mimeType: string | null
    /** When the provider removes it, or null. */
    readonly expiresAt: string | null
    /** The file store's id once stored, or null. */
    readonly stored: string | null
}

/** A provider that opens one of its files again by its handle, on one connected account: what the file store (G3) calls to take it. */
export interface ProviderFileReader {
    /** The provider key. */
    readonly provider: string
    /** The file behind a handle this provider answered earlier on that account. */
    open(connection: ConnectionRecord, handle: string): ProviderFile
}

/** Where the generic file store keeps a provider's file: G3's port, bound by the app once it exists; absent = no store yet. */
export interface ProviderFileSink {
    /** Keeps the file's bytes for the workspace and answers the store's id. */
    store(workspaceId: string, file: ProviderFile): Promise<string>
}

/** One voice a speech provider offers an account. */
export interface SpeechVoice {
    /** The provider's id of the voice. */
    readonly voiceId: string
    /** Its name. */
    readonly name: string
    /** The provider's category word, or null. */
    readonly category: string | null
    /** The provider's labels (accent, gender, use case ...). */
    readonly labels: Readonly<Record<string, string>>
    /** A sample to listen to, or null. */
    readonly previewUrl: string | null
}

/** What a voice list is asked for. */
export interface SpeechVoiceQuery {
    /** Words the provider searches the voices by, or null. */
    readonly search: string | null
    /** The most voices. */
    readonly pageSize: number
    /** The point to page from, as an earlier page answered it, or null. */
    readonly pageToken: string | null
}

/** One page of voices. */
export interface SpeechVoicePage {
    /** The voices. */
    readonly voices: ReadonlyArray<SpeechVoice>
    /** The point to page from, or null at the end. */
    readonly nextPageToken: string | null
}

/** What a speech synthesis is asked for. */
export interface SpeechRequest {
    /** The text to speak. */
    readonly text: string
    /** The provider's voice id. */
    readonly voiceId: string
    /** The provider's model id, or null for the provider's default. */
    readonly modelId: string | null
    /** The language (ISO 639-1), or null to let the model decide. */
    readonly languageCode: string | null
    /** The provider's output format word, or null for its default. */
    readonly format: string | null
    /** The seed, or null. */
    readonly seed: number | null
}

/** A provider that turns text into speech. */
export interface SpeechPort {
    /** The provider key. */
    readonly provider: string
    /** The voices of one account. */
    voices(connection: ConnectionRecord, query: SpeechVoiceQuery): Promise<SpeechVoicePage>
    /** The audio of one text, made on one account. */
    synthesize(connection: ConnectionRecord, request: SpeechRequest): Promise<ProviderFile>
}

/** Where an asynchronous job of a provider stands: still running, done with its files, or failed with the provider's words. */
export type ProviderJobState = "pending" | "done" | "failed"

/** What a dubbing is asked for. */
export interface DubbingRequest {
    /** The address of the source video or audio. */
    readonly sourceUrl: string
    /** The language to dub into (ISO 639-1 or 639-3). */
    readonly targetLanguage: string
    /** The source language, or null to let the provider detect it. */
    readonly sourceLanguage: string | null
    /** The name of the project, or null. */
    readonly name: string | null
    /** The number of speakers, or null to let the provider detect them. */
    readonly speakers: number | null
    /** Whether the output carries the provider's watermark, or null for its default. */
    readonly watermark: boolean | null
}

/** A dubbing job a provider started. */
export interface DubbingStarted {
    /** The provider's job id. */
    readonly jobId: string
    /** How long the provider expects it to take, in seconds, or null. */
    readonly expectedSeconds: number | null
}

/** A dubbing job as it stands. */
export interface DubbingJob {
    /** The provider's job id. */
    readonly jobId: string
    /** Where it stands. */
    readonly state: ProviderJobState
    /** The provider's own status word. */
    readonly providerStatus: string
    /** The languages it dubs into. */
    readonly targetLanguages: ReadonlyArray<string>
    /** The provider's words on a failure, or null. */
    readonly error: string | null
    /** One file per target language once done; empty otherwise. */
    readonly files: ReadonlyArray<ProviderFile>
}

/** A provider that dubs a video or audio into another language: an asynchronous job, started then polled. */
export interface DubbingPort {
    /** The provider key. */
    readonly provider: string
    /** Starts one dubbing on one account. */
    create(connection: ConnectionRecord, request: DubbingRequest): Promise<DubbingStarted>
    /** The job as it stands. */
    get(connection: ConnectionRecord, jobId: string): Promise<DubbingJob>
}

/** An image a video starts from, as base64 bytes. */
export interface VideoImage {
    /** Its media type. */
    readonly mimeType: string
    /** The bytes, base64. */
    readonly data: string
}

/** What a video generation is asked for. */
export interface VideoRequest {
    /** What the video shows. */
    readonly prompt: string
    /** The image it starts from, or null. */
    readonly image: VideoImage | null
    /** The provider's model id, or null for the account's own. */
    readonly modelId: string | null
    /** The provider's aspect ratio word, or null for its default. */
    readonly aspectRatio: string | null
    /** The provider's resolution word, or null for its default. */
    readonly resolution: string | null
    /** The length in seconds as the provider takes it, or null for its default. */
    readonly durationSeconds: string | null
    /** The provider's people rule word, or null for its default. */
    readonly personGeneration: string | null
    /** The seed, or null. */
    readonly seed: number | null
}

/** A video generation a provider started. */
export interface VideoStarted {
    /** The provider's job id (its operation name). */
    readonly jobId: string
    /** The model it runs on. */
    readonly modelId: string
}

/** A video generation as it stands. */
export interface VideoJob {
    /** The provider's job id. */
    readonly jobId: string
    /** Where it stands. */
    readonly state: ProviderJobState
    /** The provider's error once failed: its code and words; null otherwise. */
    readonly error: { readonly code: number | null; readonly message: string } | null
    /** The generated videos once done; empty otherwise (a done job with none was blocked by the provider's filters). */
    readonly files: ReadonlyArray<ProviderFile>
}

/** A provider that generates a video: an asynchronous job, started then polled. */
export interface VideoGenerationPort {
    /** The provider key. */
    readonly provider: string
    /** Starts one generation on one account. */
    start(connection: ConnectionRecord, request: VideoRequest): Promise<VideoStarted>
    /** The job as it stands. */
    get(connection: ConnectionRecord, jobId: string): Promise<VideoJob>
}

/**
 * Why a provider call did nothing, proved where it was refused: `rejected`, the provider refused the request's content (a validation
 * error); `not_found`, the voice, job or file is not there; `auth_refused`, it refused the account's credential; `no_credential`, the
 * account holds no credential, so nothing was sent; `not_available`, the operation is not built (its documentation could not be read),
 * so nothing was sent.
 */
export type ProviderRefusalReason = "rejected" | "not_found" | "auth_refused" | "no_credential" | "not_available"

/**
 * Every refusal a generic media tool answers (`nivo.tool.speech.*`, `nivo.tool.dubbing.*`, `nivo.tool.video.*`), whichever provider
 * served it: `not_connected` (no account handed or no credential), `connection_refused` (the provider refused the credential),
 * `rejected`, `not_found`, `not_available` (the operation is not built) and `file_store_unavailable` (no file store bound for a clip).
 * A leaf list, so the engine's tool registry states it without importing the tools.
 */
export const MEDIA_TOOL_REFUSALS: readonly ["not_connected", "connection_refused", "rejected", "not_found", "not_available", "file_store_unavailable"] = [
    "not_connected",
    "connection_refused",
    "rejected",
    "not_found",
    "not_available",
    "file_store_unavailable",
] as const satisfies ReadonlyArray<string>

/** One refusal of a generic media tool. */
export type MediaToolRefusal = (typeof MEDIA_TOOL_REFUSALS)[number]

/**
 * The refusals of a generic media tool a node reads and goes on from (class `business` in the tools' `MEDIA_REFUSAL_CLASS`, a spec
 * holds the two equal): the engine's tool registry lists exactly these; the others (no account, a refused credential, an operation not
 * built, no file store) freeze the step.
 */
export const MEDIA_TOOL_BUSINESS_REFUSALS: readonly ["rejected", "not_found"] = ["rejected", "not_found"] as const satisfies ReadonlyArray<MediaToolRefusal>
