import type { SpeechVoice } from "@modules/domain/provider-registry"
import type { SandboxCatalogue } from "@modules/domain/provider-sandbox"

/*
 * ELEVENLABS' SANDBOX CATALOGUE (owner ruling R60): fixed named cases `ELEVENLABS-<n>`, identical on every machine, for the three ports
 * ElevenLabs registers: speech (voices, synthesize), dubbing (create, get: a job started, then POLLED: ElevenLabs sends no webhook to
 * NIVO, so the catalogue has no inbound case) and the files it holds (a dubbed language reopened by its handle). A speech request picks
 * its case by the voice id, a dubbing by the source address, a file by its handle. The refusal words are representative: the live adapter
 * carries whatever words ElevenLabs answered.
 */

/** The provider key of the catalogue. */
export const ELEVENLABS_SANDBOX_PROVIDER = "elevenlabs"

/** The voices every sandbox account lists, in their order (the library of the catalogue). */
export const ELEVENLABS_SANDBOX_VOICES: ReadonlyArray<SpeechVoice> = [
    {
        voiceId: "SBX-VOICE-RACHEL",
        name: "Rachel",
        category: "premade",
        labels: { accent: "american", gender: "female", use_case: "narration" },
        previewUrl: "https://sandbox.nivo.test/elevenlabs/previews/rachel.mp3",
    },
    {
        voiceId: "SBX-VOICE-ADAM",
        name: "Adam",
        category: "premade",
        labels: { accent: "american", gender: "male", use_case: "narration" },
        previewUrl: "https://sandbox.nivo.test/elevenlabs/previews/adam.mp3",
    },
    {
        voiceId: "SBX-VOICE-LIEN",
        name: "Lien",
        category: "generated",
        labels: { accent: "northern", gender: "female", use_case: "conversational" },
        previewUrl: null,
    },
]

/** The searches the catalogue names, with the voice ids each finds; a search it does not name finds none. */
export const ELEVENLABS_SANDBOX_SEARCHES: Readonly<Record<string, ReadonlyArray<string>>> = {
    Rachel: ["SBX-VOICE-RACHEL"],
    narration: ["SBX-VOICE-RACHEL", "SBX-VOICE-ADAM"],
}

/** The voice ids of the speech cases that do not answer a clip. */
export const ELEVENLABS_SANDBOX_VOICE_IDS = {
    quota: "SBX-VOICE-QUOTA",
} as const

/** The prefix of a page token: `SBX-PAGE-<offset>` is the point to page from. */
export const ELEVENLABS_SANDBOX_PAGE_TOKEN_PREFIX = "SBX-PAGE-"

/** ElevenLabs' words for a page token it never issued (a 4xx: `rejected`). */
export const ELEVENLABS_SANDBOX_PAGE_TOKEN_MESSAGE = "The next_page_token is not valid."

/** The media type and bytes of every synthesized clip (a fixed small content: the bytes carry the voice that spoke). */
export const ELEVENLABS_SANDBOX_SPEECH_MIME = "audio/mpeg"

/** The bytes of the clip a voice speaks: fixed, naming the voice and the text. */
export const elevenLabsSandboxClipOf = (voiceId: string, text: string): Buffer => Buffer.from(`SBX-SPEECH|${voiceId}|${text}`, "utf8")

/** The bytes of one dubbed language of a dubbing: fixed. */
export const elevenLabsSandboxDubbedBytesOf = (dubbingId: string, language: string): Buffer => Buffer.from(`SBX-DUBBED|${dubbingId}|${language}`, "utf8")

/** ElevenLabs' words when the quota of the account is spent (an answered refusal: `rejected`). */
export const ELEVENLABS_SANDBOX_QUOTA_MESSAGE = "This request exceeds your quota limit."

/** ElevenLabs' words for a voice the account does not hold (a 404). */
export const ELEVENLABS_SANDBOX_VOICE_NOT_FOUND_MESSAGE = "A voice with the voice id was not found."

/** ElevenLabs' words for a dubbing the account does not hold (a 404). */
export const ELEVENLABS_SANDBOX_DUBBING_NOT_FOUND_MESSAGE = "Dubbing project not found."

/** ElevenLabs' words when a dubbing source cannot be used (a 4xx: `rejected`). */
export const ELEVENLABS_SANDBOX_SOURCE_REFUSED_MESSAGE = "The source URL could not be fetched."

/** The failure words of a dub that ends in error. */
export const ELEVENLABS_SANDBOX_DUBBING_ERROR = "Dubbing failed: no speech was detected in the source."

/** The status word of a dub in progress and of a finished one (the reference's example). */
export const ELEVENLABS_SANDBOX_DUBBING_STATUSES = { running: "dubbing", done: "dubbed", failed: "failed" } as const

/** How long ElevenLabs says a dub takes (seconds). */
export const ELEVENLABS_SANDBOX_EXPECTED_SECONDS = 30

/** What a dubbing start comes to. */
export type ElevenLabsSandboxDubbingOutcome = "completes" | "fails" | "refused" | "unknown"

/** One dubbing case of the table: the source address that picks it and what comes of it. */
export interface ElevenLabsSandboxDubbingCase {
    /** The catalogue case id. */
    readonly caseId: string
    /** The source address that picks the case. */
    readonly sourceUrl: string
    /** What it comes to. */
    readonly outcome: ElevenLabsSandboxDubbingOutcome
}

/** The source addresses of the dubbing cases. */
export const ELEVENLABS_SANDBOX_SOURCES = {
    completes: "https://sandbox.nivo.test/media/completes.mp4",
    fails: "https://sandbox.nivo.test/media/fails.mp4",
    refused: "https://sandbox.nivo.test/media/refused.mp4",
    serverError: "https://sandbox.nivo.test/media/server-error.mp4",
} as const

/** The dubbing cases by source address; a source the catalogue does not name takes the first (a dub that completes). */
export const ELEVENLABS_SANDBOX_DUBBINGS: ReadonlyArray<ElevenLabsSandboxDubbingCase> = [
    { caseId: "ELEVENLABS-6", sourceUrl: ELEVENLABS_SANDBOX_SOURCES.completes, outcome: "completes" },
    { caseId: "ELEVENLABS-7", sourceUrl: ELEVENLABS_SANDBOX_SOURCES.fails, outcome: "fails" },
    { caseId: "ELEVENLABS-8", sourceUrl: ELEVENLABS_SANDBOX_SOURCES.refused, outcome: "refused" },
    { caseId: "ELEVENLABS-9", sourceUrl: ELEVENLABS_SANDBOX_SOURCES.serverError, outcome: "unknown" },
]

/** The id of the dubbing a sandbox account starts as its start number `seq` + 1. */
export const elevenLabsSandboxDubbingId = (seq: number): string => `SBX-DUBBING-${String(seq + 1).padStart(6, "0")}`

/** The hardcoded catalogue of ElevenLabs' sandbox. */
export const ELEVENLABS_SANDBOX_CATALOGUE: SandboxCatalogue = {
    provider: ELEVENLABS_SANDBOX_PROVIDER,
    cases: [
        { id: "ELEVENLABS-1", label: "The voice list: the three fixed voices, paged by the page size with a next-page token", operation: "voices" },
        { id: "ELEVENLABS-2", label: "A voice search the catalogue names (Rachel, narration) finds its voices; any other search finds none", operation: "voices" },
        { id: "ELEVENLABS-3", label: "Speech of a voice the catalogue holds: a clip of fixed bytes (audio/mpeg) behind a speech handle", operation: "synthesize" },
        { id: "ELEVENLABS-4", label: "Speech of a voice the account does not hold: not_found refusal", operation: "synthesize" },
        { id: "ELEVENLABS-5", label: "Speech refused for a spent quota (the voice SBX-VOICE-QUOTA): rejected, nothing sent", operation: "synthesize" },
        {
            id: "ELEVENLABS-6",
            label: "A dubbing is accepted and later completes: reads see dubbing, then dubbed with one file per target language",
            operation: "create",
        },
        { id: "ELEVENLABS-7", label: "A dubbing is accepted and later fails: reads end failed with ElevenLabs' words", operation: "create" },
        { id: "ELEVENLABS-8", label: "A dubbing is refused at start (source unusable): rejected, nothing sent", operation: "create" },
        { id: "ELEVENLABS-9", label: "A dubbing start ends in an unknown outcome (5xx): the job exists, the caller cannot know it", operation: "create" },
        { id: "ELEVENLABS-10", label: "A dubbing read of a job the account does not hold: not_found refusal", operation: "get" },
        { id: "ELEVENLABS-11", label: "A dubbed language reopened by its handle (dubbing/<id>/<language>) of a job the account holds: fixed bytes", operation: "file" },
        { id: "ELEVENLABS-12", label: "A handle that is no dubbed language (a speech clip's handle) or of a job the account does not hold: not_found refusal", operation: "file" },
    ],
}
