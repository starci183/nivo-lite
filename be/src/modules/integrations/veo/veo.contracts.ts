/**
 * The parameter values the Veo guide documents (https://aistudio.google.com/docs/veo, "Parameters"): `aspectRatio` `16:9` (default) or
 * `9:16`; `resolution` `720p` (default), `1080p` (8 s only), `4k` (8 s only, not Lite); `durationSeconds` `4`, `6`, `8` (strings; `8` for
 * 1080p / 4k, reference images, extension); `personGeneration` `allow_all` (text-to-video) or `allow_adult` (image-to-video); one video
 * per request. The combinations are Google's to refuse (`400 INVALID_ARGUMENT`), not NIVO's.
 */
export const VEO_ASPECT_RATIOS = ["16:9", "9:16"] as const
export const VEO_RESOLUTIONS = ["720p", "1080p", "4k"] as const
export const VEO_DURATIONS = ["4", "6", "8"] as const
export const VEO_PERSON_GENERATION = ["allow_all", "allow_adult"] as const

/** The media type of a start image the guide shows (`inlineData.mimeType`: `image/png`); no other is documented, so none is sent. */
export const VEO_IMAGE_TYPES = ["image/png"] as const

/** How long Google keeps a generated video ("stored for 2 days, then removed"). */
export const VEO_RETENTION_MS: number = 2 * 24 * 3_600_000

/** What one generation sends: `instances[0]` and `parameters`. */
export interface VeoGenerateRequest {
    /** The model id of the path (`models/{model}:predictLongRunning`). */
    readonly model: string
    /** `instances[0].prompt`. */
    readonly prompt: string
    /** `instances[0].image.inlineData` (`mimeType`, base64 `data`), or null. */
    readonly image: { readonly mimeType: string; readonly data: string } | null
    /** `parameters.aspectRatio`, or null. */
    readonly aspectRatio: string | null
    /** `parameters.resolution`, or null. */
    readonly resolution: string | null
    /** `parameters.durationSeconds`, or null. */
    readonly durationSeconds: string | null
    /** `parameters.personGeneration`, or null. */
    readonly personGeneration: string | null
    /** `parameters.seed`, or null. */
    readonly seed: number | null
}

/** A long-running operation as it stands (the members NIVO reads). */
export interface VeoOperation {
    /** `name`: the operation name, polled by `GET {base}/{name}`. */
    readonly name: string
    /** `done`. */
    readonly done: boolean
    /** `error` (`code`, `message`) once it failed, else null. */
    readonly error: { readonly code: number | null; readonly message: string } | null
    /** `response.generateVideoResponse.generatedSamples[].video.uri` once done; empty otherwise. */
    readonly videoUris: ReadonlyArray<string>
}

/** A downloaded video. */
export interface VeoVideo {
    /** The bytes. */
    readonly bytes: Buffer
    /** The answer's `content-type`, or null. */
    readonly contentType: string | null
}
