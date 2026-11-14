import { createHash } from "node:crypto"
import { Injectable } from "@nestjs/common"
import type { ConnectionRecord } from "@modules/domain/connections"
import {
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
    type SpeechVoicePage,
    type SpeechVoiceQuery,
} from "@modules/domain/provider-registry"
import {
    ELEVENLABS_OUTPUT_FORMATS,
    InjectElevenLabs,
    type ElevenLabsClient,
    type ElevenLabsDubbing,
    type ElevenLabsOutputFormat,
} from "@modules/integrations/elevenlabs"
import { ElevenLabsCredentialService } from "./elevenlabs-credential.service"
import { ELEVENLABS_PROVIDER, elevenLabsFailureOf } from "./elevenlabs-failure.policy"
import { DomainError } from "@modules/platform/errors"

/** The `status` the dubbing reference shows for a finished dub (its example: `"dubbed"`; it lists no other value). */
const DUBBED = "dubbed"

/** The handle prefix of a dubbed file: `dubbing/<dubbing_id>/<language_code>`, reopened by the dubbed-file operation. */
const DUBBING_HANDLE = "dubbing"

/** The handle prefix of a synthesized clip: answered in the call itself, so it cannot be reopened (`speech/<sha256>`). */
const SPEECH_HANDLE = "speech"

/** The output format a request names, when it is one the convert documents; null for the default. */
const formatOf = (format: string | null): ElevenLabsOutputFormat | null =>
    ELEVENLABS_OUTPUT_FORMATS.find((known) => known === format) ?? null

/**
 * Where a dub stands, by the documented members alone: `error` set ("describes the failure if the dub failed") is failed; the status
 * `dubbed` is done; anything else is still running.
 */
export const dubbingStateOf = (dubbing: ElevenLabsDubbing): DubbingJob["state"] => {
    if (dubbing.error !== null) return "failed"
    return dubbing.status === DUBBED ? "done" : "pending"
}

/** The handle of one dubbed language. */
export const dubbedHandleOf = (dubbingId: string, language: string): string => `${DUBBING_HANDLE}/${dubbingId}/${language}`

/** The dubbing id and language of a dubbed handle, or null for any other handle. */
const dubbedPartsOf = (handle: string): { readonly dubbingId: string; readonly language: string } | null => {
    const [prefix, dubbingId, language, ...rest] = handle.split("/")
    if (prefix !== DUBBING_HANDLE || dubbingId === undefined || language === undefined || rest.length > 0) return null
    return dubbingId === "" || language === "" ? null : { dubbingId, language }
}

@Injectable()
/**
 * ElevenLabs as the adapter of the generic media purposes: speech (`SpeechPort`: the voices of an account, text to an audio clip),
 * dubbing (`DubbingPort`: a job started, then polled) and the files it holds (`ProviderFileReader`: a dubbed language reopened by its
 * handle). Each call runs on the account handed, with its own API key; a failure is thrown with what it proves.
 */
export class ElevenLabsMediaService implements SpeechPort, DubbingPort, ProviderFileReader {
    /** The provider key. */
    readonly provider: string = ELEVENLABS_PROVIDER

    constructor(
        @InjectElevenLabs() private readonly client: ElevenLabsClient,
        private readonly credentials: ElevenLabsCredentialService,
    ) {}

    /** The voices of the account, one page (`GET /v2/voices`). */
    async voices(connection: ConnectionRecord, query: SpeechVoiceQuery): Promise<SpeechVoicePage> {
        const key = await this.credentials.keyOf(connection)
        const page = await this.guarded(() =>
            this.client.searchVoices(key, { search: query.search, pageSize: query.pageSize, nextPageToken: query.pageToken }),
        )
        return { voices: page.voices, nextPageToken: page.hasMore ? page.nextPageToken : null }
    }

    /** The audio of one text (`POST /v1/text-to-speech/{voice_id}`), held in memory: its handle cannot be reopened. */
    async synthesize(connection: ConnectionRecord, request: SpeechRequest): Promise<ProviderFile> {
        const key = await this.credentials.keyOf(connection)
        const audio = await this.guarded(() =>
            this.client.convert(key, {
                voiceId: request.voiceId,
                text: request.text,
                modelId: request.modelId,
                languageCode: request.languageCode,
                seed: request.seed,
                outputFormat: formatOf(request.format),
            }),
        )
        const digest = createHash("sha256").update(audio.bytes).digest("hex")
        return {
            provider: this.provider,
            handle: `${SPEECH_HANDLE}/${digest}`,
            mimeType: audio.contentType,
            expiresAt: null,
            fetch: () => Promise.resolve(audio.bytes),
        }
    }

    /** Starts one dub from a source address (`POST /v1/dubbing`). */
    async create(connection: ConnectionRecord, request: DubbingRequest): Promise<DubbingStarted> {
        const key = await this.credentials.keyOf(connection)
        const started = await this.guarded(() =>
            this.client.createDubbing(key, {
                sourceUrl: request.sourceUrl,
                targetLang: request.targetLanguage,
                sourceLang: request.sourceLanguage,
                name: request.name,
                numSpeakers: request.speakers,
                watermark: request.watermark,
            }),
        )
        return { jobId: started.dubbingId, expectedSeconds: started.expectedDurationSec }
    }

    /** The dub as it stands (`GET /v1/dubbing/{dubbing_id}`); once done, one file per target language. */
    async get(connection: ConnectionRecord, jobId: string): Promise<DubbingJob> {
        const key = await this.credentials.keyOf(connection)
        const dubbing = await this.guarded(() => this.client.getDubbing(key, jobId))
        const state = dubbingStateOf(dubbing)
        return {
            jobId: dubbing.dubbingId,
            state,
            providerStatus: dubbing.status,
            targetLanguages: dubbing.targetLanguages,
            error: dubbing.error,
            files:
                state === "done"
                    ? dubbing.targetLanguages.map((language) => this.open(connection, dubbedHandleOf(dubbing.dubbingId, language)))
                    : [],
        }
    }

    /**
     * The file behind a handle on the account: a dubbed language is read on `fetch` (`GET /v1/dubbing/{id}/audio/{language}`); a
     * synthesized clip was answered in its call and is not held by ElevenLabs under a handle, so its `fetch` refuses `not_found`.
     */
    open(connection: ConnectionRecord, handle: string): ProviderFile {
        const parts = dubbedPartsOf(handle)
        const fetch = async (): Promise<Buffer> => {
            if (parts === null) throw withProof(providerRefusal(this.provider, "not_found", "handle"), "not_sent")
            const key = await this.credentials.keyOf(connection)
            const file = await this.guarded(() => this.client.dubbedFile(key, parts.dubbingId, parts.language))
            return file.bytes
        }
        return { provider: this.provider, handle, mimeType: null, expiresAt: null, fetch }
    }

    private async guarded<T>(call: () => Promise<T>): Promise<T> {
        try {
            return await call()
        } catch (cause) {
            const failure = elevenLabsFailureOf(cause)
            if (failure instanceof DomainError) throw failure
            throw cause
        }
    }
}
