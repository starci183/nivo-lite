/**
 * The output formats the text-to-speech convert documents (query `output_format`,
 * https://elevenlabs.io/docs/api-reference/text-to-speech/convert); its default is `mp3_44100_128`. Some need a higher plan (192 kbps
 * MP3: Creator; 44.1 kHz PCM / WAV: Pro): ElevenLabs refuses those on a lower plan.
 */
export const ELEVENLABS_OUTPUT_FORMATS = [
    "alaw_8000",
    "mp3_22050_32",
    "mp3_24000_48",
    "mp3_44100_32",
    "mp3_44100_64",
    "mp3_44100_96",
    "mp3_44100_128",
    "mp3_44100_192",
    "opus_48000_32",
    "opus_48000_64",
    "opus_48000_96",
    "opus_48000_128",
    "opus_48000_192",
    "pcm_8000",
    "pcm_16000",
    "pcm_22050",
    "pcm_24000",
    "pcm_32000",
    "pcm_44100",
    "pcm_48000",
    "ulaw_8000",
    "wav_8000",
    "wav_16000",
    "wav_22050",
    "wav_24000",
    "wav_32000",
    "wav_44100",
    "wav_48000",
] as const

/** One output format word. */
export type ElevenLabsOutputFormat = (typeof ELEVENLABS_OUTPUT_FORMATS)[number]

/** The highest seed the convert takes (`seed`: 0 to 4294967295). */
export const ELEVENLABS_SEED_MAX = 4_294_967_295

/** The most voices one search page answers (`page_size` "cannot exceed 100"). */
export const ELEVENLABS_VOICE_PAGE_MAX = 100

/** What one text-to-speech convert sends: the documented body members NIVO uses and the output format. */
export interface ElevenLabsSpeechRequest {
    /** `voice_id` (path). */
    readonly voiceId: string
    /** `text`. */
    readonly text: string
    /** `model_id`, or null for ElevenLabs' default (`eleven_multilingual_v2`). */
    readonly modelId: string | null
    /** `language_code` (ISO 639-1), or null. */
    readonly languageCode: string | null
    /** `seed`, or null. */
    readonly seed: number | null
    /** `output_format` (query), or null for the default. */
    readonly outputFormat: ElevenLabsOutputFormat | null
}

/** Audio bytes ElevenLabs answered. */
export interface ElevenLabsAudio {
    /** The bytes. */
    readonly bytes: Buffer
    /** The answer's `content-type`, or null when it named none. */
    readonly contentType: string | null
}

/** What one voice search asks (query members). */
export interface ElevenLabsVoiceSearch {
    /** `search`, or null. */
    readonly search: string | null
    /** `page_size` (1 to 100). */
    readonly pageSize: number
    /** `next_page_token`, or null. */
    readonly nextPageToken: string | null
}

/** One voice of a search answer (`voices[]`). */
export interface ElevenLabsVoice {
    /** `voice_id`. */
    readonly voiceId: string
    /** `name`. */
    readonly name: string
    /** `category`, or null. */
    readonly category: string | null
    /** `labels`. */
    readonly labels: Readonly<Record<string, string>>
    /** `preview_url`, or null. */
    readonly previewUrl: string | null
}

/** A voice search answer. */
export interface ElevenLabsVoicePage {
    /** `voices`. */
    readonly voices: ReadonlyArray<ElevenLabsVoice>
    /** `has_more`. */
    readonly hasMore: boolean
    /** `next_page_token`, or null. */
    readonly nextPageToken: string | null
}

/** What one dubbing create sends (form fields). */
export interface ElevenLabsDubbingRequest {
    /** `source_url`. */
    readonly sourceUrl: string
    /** `target_lang` (required). */
    readonly targetLang: string
    /** `source_lang`, or null for detection. */
    readonly sourceLang: string | null
    /** `name`, or null. */
    readonly name: string | null
    /** `num_speakers` (0 detects), or null. */
    readonly numSpeakers: number | null
    /** `watermark`, or null. */
    readonly watermark: boolean | null
}

/** A dubbing create answer. */
export interface ElevenLabsDubbingStarted {
    /** `dubbing_id`. */
    readonly dubbingId: string
    /** `expected_duration_sec`. */
    readonly expectedDurationSec: number
}

/** A dubbing get answer (the members NIVO reads). */
export interface ElevenLabsDubbing {
    /** `dubbing_id`. */
    readonly dubbingId: string
    /** `name`. */
    readonly name: string
    /** `status` (the reference's example: `dubbed`; it lists no other value). */
    readonly status: string
    /** `target_languages`. */
    readonly targetLanguages: ReadonlyArray<string>
    /** `error`, or null ("describes the failure if the dub failed"). */
    readonly error: string | null
}
