import { createHash } from "node:crypto"
import { Injectable } from "@nestjs/common"
import type { ConnectionRecord } from "@modules/domain/connections"
import {
    providerCallFailure,
    providerRefusal,
    withProof,
    type DubbingJob,
    type DubbingPort,
    type DubbingRequest,
    type DubbingStarted,
    type ProviderFile,
    type ProviderFileReader,
    type SpeechPort,
    type SpeechRequest,
    type SpeechVoice,
    type SpeechVoicePage,
    type SpeechVoiceQuery,
} from "@modules/domain/provider-registry"
import { ProviderSandboxService } from "@modules/domain/provider-sandbox"
import {
    ELEVENLABS_SANDBOX_DUBBINGS,
    ELEVENLABS_SANDBOX_DUBBING_ERROR,
    ELEVENLABS_SANDBOX_DUBBING_NOT_FOUND_MESSAGE,
    ELEVENLABS_SANDBOX_DUBBING_STATUSES,
    ELEVENLABS_SANDBOX_EXPECTED_SECONDS,
    ELEVENLABS_SANDBOX_PAGE_TOKEN_MESSAGE,
    ELEVENLABS_SANDBOX_PAGE_TOKEN_PREFIX,
    ELEVENLABS_SANDBOX_PROVIDER,
    ELEVENLABS_SANDBOX_QUOTA_MESSAGE,
    ELEVENLABS_SANDBOX_SEARCHES,
    ELEVENLABS_SANDBOX_SOURCE_REFUSED_MESSAGE,
    ELEVENLABS_SANDBOX_SPEECH_MIME,
    ELEVENLABS_SANDBOX_VOICES,
    ELEVENLABS_SANDBOX_VOICE_IDS,
    ELEVENLABS_SANDBOX_VOICE_NOT_FOUND_MESSAGE,
    elevenLabsSandboxClipOf,
    elevenLabsSandboxDubbedBytesOf,
    elevenLabsSandboxDubbingId,
    type ElevenLabsSandboxDubbingCase,
} from "./elevenlabs-sandbox.catalogue"

/** The state operation that holds one started dubbing, by its id: its case, its target language and how many reads it has taken. */
const DUBBING_STATE = "dubbing"

/** The handle prefix of a dubbed file, as the live twin names it: `dubbing/<dubbing_id>/<language_code>`. */
const DUBBING_HANDLE = "dubbing"

/** The handle prefix of a synthesized clip, as the live twin names it: `speech/<sha256>`. */
const SPEECH_HANDLE = "speech"

/** What the account's state keeps of a started dubbing. */
interface KeptDubbing {
    readonly caseId: string
    readonly target: string
    readonly reads: number
}

/** A kept dubbing read back, or null when the value is not one. */
const keptDubbingOf = (value: unknown): KeptDubbing | null => {
    if (typeof value !== "object" || value === null) return null
    const caseId: unknown = Reflect.get(value, "caseId")
    const target: unknown = Reflect.get(value, "target")
    const reads: unknown = Reflect.get(value, "reads")
    return typeof caseId === "string" && typeof target === "string" && typeof reads === "number" ? { caseId, target, reads } : null
}

/** The handle of one dubbed language. */
const dubbedHandleOf = (dubbingId: string, language: string): string => `${DUBBING_HANDLE}/${dubbingId}/${language}`

/** The dubbing id and language of a dubbed handle, or null for any other handle (as the live twin reads it). */
const dubbedPartsOf = (handle: string): { readonly dubbingId: string; readonly language: string } | null => {
    const [prefix, dubbingId, language, ...rest] = handle.split("/")
    if (prefix !== DUBBING_HANDLE || dubbingId === undefined || language === undefined || rest.length > 0) return null
    return dubbingId === "" || language === "" ? null : { dubbingId, language }
}

/** The offset a page token names, or null for a token the sandbox never issued. */
const offsetOfToken = (token: string): number | null => {
    if (!token.startsWith(ELEVENLABS_SANDBOX_PAGE_TOKEN_PREFIX)) return null
    const offset = Number(token.slice(ELEVENLABS_SANDBOX_PAGE_TOKEN_PREFIX.length))
    return Number.isInteger(offset) && offset >= 0 ? offset : null
}

/** An answered refusal as the live twin throws it: the provider's words, proved `not_sent`. */
const refusal = (reason: "rejected" | "not_found", detail: string): Error => withProof(providerRefusal(ELEVENLABS_SANDBOX_PROVIDER, reason, detail), "not_sent")

@Injectable()
/**
 * ElevenLabs' SANDBOX implementation of its three ports (speech, dubbing and the files it holds; owner rulings R56 / R59 / R60): used
 * when the provider account is a sandbox account, it answers from the hardcoded catalogue (`ELEVENLABS-<n>`) and the account's state
 * through the generic sandbox frame, and never reaches a host. A speech request picks its case by the voice, a dubbing by its source
 * address; a dubbing is read back as a live poll sees it (dubbing, then the end, one step per read), its dubbed languages reopened by
 * their handle with fixed bytes. A refusal is the error the live adapter throws for the same case.
 */
export class ElevenLabsSandboxMediaService implements SpeechPort, DubbingPort, ProviderFileReader {
    /** The provider key. */
    readonly provider: string = ELEVENLABS_SANDBOX_PROVIDER

    constructor(private readonly sandbox: ProviderSandboxService) {}

    /** One page of the catalogue's voices (all of them, or a search the catalogue names), from the point the token names. */
    voices(connection: ConnectionRecord, query: SpeechVoiceQuery): Promise<SpeechVoicePage> {
        return this.sandbox.call(
            connection,
            "voices",
            { query },
            {
                key: query.search ?? "",
                answer: (): SpeechVoicePage => {
                    const offset = query.pageToken === null ? 0 : offsetOfToken(query.pageToken)
                    if (offset === null) throw refusal("rejected", ELEVENLABS_SANDBOX_PAGE_TOKEN_MESSAGE)
                    const found: ReadonlyArray<SpeechVoice> =
                        query.search === null
                            ? ELEVENLABS_SANDBOX_VOICES
                            : ELEVENLABS_SANDBOX_VOICES.filter((voice) => (ELEVENLABS_SANDBOX_SEARCHES[query.search ?? ""] ?? []).includes(voice.voiceId))
                    const end = offset + query.pageSize
                    return {
                        voices: found.slice(offset, end),
                        nextPageToken: end < found.length ? `${ELEVENLABS_SANDBOX_PAGE_TOKEN_PREFIX}${String(end)}` : null,
                    }
                },
            },
        )
    }

    /** The clip of one text: fixed bytes naming the voice and the text, held in memory behind a speech handle. */
    synthesize(connection: ConnectionRecord, request: SpeechRequest): Promise<ProviderFile> {
        return this.sandbox.call(
            connection,
            "synthesize",
            { request },
            {
                key: request.voiceId,
                answer: (): ProviderFile => {
                    if (request.voiceId === ELEVENLABS_SANDBOX_VOICE_IDS.quota) throw refusal("rejected", ELEVENLABS_SANDBOX_QUOTA_MESSAGE)
                    if (!ELEVENLABS_SANDBOX_VOICES.some((voice) => voice.voiceId === request.voiceId)) {
                        throw refusal("not_found", ELEVENLABS_SANDBOX_VOICE_NOT_FOUND_MESSAGE)
                    }
                    const bytes = elevenLabsSandboxClipOf(request.voiceId, request.text)
                    return {
                        provider: this.provider,
                        handle: `${SPEECH_HANDLE}/${createHash("sha256").update(bytes).digest("hex")}`,
                        mimeType: ELEVENLABS_SANDBOX_SPEECH_MIME,
                        expiresAt: null,
                        fetch: () => Promise.resolve(bytes),
                    }
                },
            },
        )
    }

    /** Starts one dubbing: refused, accepted (its id is the next running one) or accepted with an unknown outcome. */
    create(connection: ConnectionRecord, request: DubbingRequest): Promise<DubbingStarted> {
        return this.sandbox.call(
            connection,
            "create",
            { request },
            {
                key: request.sourceUrl,
                answer: async (state): Promise<DubbingStarted> => {
                    const chosen = ELEVENLABS_SANDBOX_DUBBINGS.find((one) => one.sourceUrl === request.sourceUrl) ?? ELEVENLABS_SANDBOX_DUBBINGS[0]
                    if (chosen === undefined || chosen.outcome === "refused") throw refusal("rejected", ELEVENLABS_SANDBOX_SOURCE_REFUSED_MESSAGE)
                    const jobId = elevenLabsSandboxDubbingId(state.seq)
                    await state.write(DUBBING_STATE, jobId, { caseId: chosen.caseId, target: request.targetLanguage, reads: 0 })
                    if (chosen.outcome === "unknown") throw providerCallFailure("unknown")
                    return { jobId, expectedSeconds: ELEVENLABS_SANDBOX_EXPECTED_SECONDS }
                },
            },
        )
    }

    /** The dub as one more read sees it: dubbing on the first read, then its end (dubbed with its files, or failed); an unknown job is `not_found`. */
    get(connection: ConnectionRecord, jobId: string): Promise<DubbingJob> {
        return this.sandbox.call(
            connection,
            "get",
            { jobId },
            {
                key: jobId,
                answer: async (state): Promise<DubbingJob> => {
                    const kept = keptDubbingOf(await state.read(DUBBING_STATE, jobId))
                    const chosen: ElevenLabsSandboxDubbingCase | undefined =
                        kept === null ? undefined : ELEVENLABS_SANDBOX_DUBBINGS.find((one) => one.caseId === kept.caseId)
                    if (kept === null || chosen === undefined) throw refusal("not_found", ELEVENLABS_SANDBOX_DUBBING_NOT_FOUND_MESSAGE)
                    await state.write(DUBBING_STATE, jobId, { ...kept, reads: kept.reads + 1 })
                    const targetLanguages = [kept.target]
                    if (kept.reads === 0) {
                        return { jobId, state: "pending", providerStatus: ELEVENLABS_SANDBOX_DUBBING_STATUSES.running, targetLanguages, error: null, files: [] }
                    }
                    if (chosen.outcome === "fails") {
                        return {
                            jobId,
                            state: "failed",
                            providerStatus: ELEVENLABS_SANDBOX_DUBBING_STATUSES.failed,
                            targetLanguages,
                            error: ELEVENLABS_SANDBOX_DUBBING_ERROR,
                            files: [],
                        }
                    }
                    return {
                        jobId,
                        state: "done",
                        providerStatus: ELEVENLABS_SANDBOX_DUBBING_STATUSES.done,
                        targetLanguages,
                        error: null,
                        files: targetLanguages.map((language) => this.open(connection, dubbedHandleOf(jobId, language))),
                    }
                },
            },
        )
    }

    /**
     * The file behind a handle on the account: a dubbed language of a dubbing the account holds answers fixed bytes on `fetch` (one
     * sandbox call); any other handle (a speech clip's, a malformed one) or a dubbing the account does not hold is `not_found`.
     */
    open(connection: ConnectionRecord, handle: string): ProviderFile {
        const fetch = (): Promise<Buffer> =>
            this.sandbox.call(
                connection,
                "file",
                { handle },
                {
                    key: handle,
                    answer: async (state): Promise<Buffer> => {
                        const parts = dubbedPartsOf(handle)
                        if (parts === null) throw refusal("not_found", "handle")
                        const kept = keptDubbingOf(await state.read(DUBBING_STATE, parts.dubbingId))
                        if (kept === null || kept.target !== parts.language) throw refusal("not_found", ELEVENLABS_SANDBOX_DUBBING_NOT_FOUND_MESSAGE)
                        return elevenLabsSandboxDubbedBytesOf(parts.dubbingId, parts.language)
                    },
                },
            )
        return { provider: this.provider, handle, mimeType: null, expiresAt: null, fetch }
    }
}
