import type { ConnectionRecord } from "@modules/domain/connections"

/*
 * THE VIDEO COMPOSE PURPOSE (`nivo.tool.video.compose`, `nivo.tool.video.render.get`): a CLOUD provider joins clips, lays a voice and
 * music under them, places a logo and burns captions, from NIVO's own NEUTRAL spec; NIVO itself runs no media work (providers rule 9).
 * The render is ASYNC: `start` answers the provider's render id at once; the provider's webhook brings the completion, which the door
 * maps with the adapter's pure `completionOf` into one `<provider>.render` row of account_data and the generic trigger
 * `nivo.trigger.video.render.completed`; `statusOf` is the polling fallback. A provider module implements `VideoComposePort` and registers
 * it under its provider key (`VideoComposeRegistryService`); nothing here names a provider. A failure is thrown with what it proves
 * (`withProof` of provider-registry): a refusal the provider answered (`providerRefusal`) proves no effect.
 */

/** The aspect ratios a spec asks for: portrait, square, landscape. */
export const COMPOSE_ASPECTS = ["9:16", "1:1", "16:9"] as const

/** One aspect ratio. */
export type ComposeAspect = (typeof COMPOSE_ASPECTS)[number]

/** The output resolutions a spec asks for, a small closed list each provider maps onto its own words (`sd` 480p, `hd` 720p, `1080`). */
export const COMPOSE_RESOLUTIONS = ["sd", "hd", "1080"] as const

/** One output resolution. */
export type ComposeResolution = (typeof COMPOSE_RESOLUTIONS)[number]

/** What an audio track is under the clips: the narration or the music bed. */
export const COMPOSE_AUDIO_ROLES = ["voice", "music"] as const

/** One audio role. */
export type ComposeAudioRole = (typeof COMPOSE_AUDIO_ROLES)[number]

/** The corner a logo sits in. */
export const COMPOSE_CORNERS = ["top-left", "top-right", "bottom-left", "bottom-right"] as const

/** One corner. */
export type ComposeCorner = (typeof COMPOSE_CORNERS)[number]

/** The part of a source clip that is used, in milliseconds from its start; `toMs` absent = to its end. */
export interface ComposeTrim {
    /** Where the used part starts in the source clip. */
    readonly fromMs: number
    /** Where it ends in the source clip; absent = the clip's end. */
    readonly toMs?: number | undefined
}

/** One clip of the timeline, in play order: a signed https address of the file store (`nivo.tool.file.get`, up to 7 days). */
export interface ComposeClip {
    /** The signed https address of the clip (NIVO never fetches it; the provider does). */
    readonly fileUrl: string
    /** The part used; absent = the whole clip. */
    readonly trimMs?: ComposeTrim | undefined
}

/** One audio track laid under the whole timeline from its start. */
export interface ComposeAudio {
    /** The signed https address of the track. */
    readonly fileUrl: string
    /** `voice` (the narration) or `music` (a bed under everything). */
    readonly role: ComposeAudioRole
    /** The loudness, 0 (silent) to 1 (as recorded); absent = 1. */
    readonly volume?: number | undefined
}

/** The logo laid over the whole timeline in one corner. */
export interface ComposeLogo {
    /** The signed https address of the picture. */
    readonly fileUrl: string
    /** The corner it sits in. */
    readonly corner: ComposeCorner
}

/** One caption burnt into the picture between two moments of the composed timeline, in milliseconds. */
export interface ComposeCaption {
    /** The words shown. */
    readonly text: string
    /** When they show, on the composed timeline. */
    readonly fromMs: number
    /** When they go, on the composed timeline. */
    readonly toMs: number
}

/** NIVO's neutral compose spec: what every compose provider is asked in the same words. */
export interface ComposeSpec {
    /** The clips, in play order (at least one). */
    readonly clips: ReadonlyArray<ComposeClip>
    /** The tracks under the timeline; absent = the clips' own sound only. */
    readonly audio?: ReadonlyArray<ComposeAudio> | undefined
    /** The logo; absent = none. */
    readonly logo?: ComposeLogo | undefined
    /** The captions; absent = none. */
    readonly captions?: ReadonlyArray<ComposeCaption> | undefined
    /** The output aspect ratio. */
    readonly aspect: ComposeAspect
    /** The output resolution. */
    readonly resolution: ComposeResolution
}

/** A render a provider accepted: its own id of it. */
export interface RenderStarted {
    /** The provider's id of the render. */
    readonly renderId: string
}

/** Where a render stands, in the neutral words every provider's status maps onto. */
export const RENDER_STATUSES = ["queued", "rendering", "done", "failed"] as const

/** One render status. */
export type RenderStatus = (typeof RENDER_STATUSES)[number]

/** The statuses after which a render changes no more: the only ones a completion carries. */
export const TERMINAL_RENDER_STATUSES = ["done", "failed"] as const

/** One terminal status. */
export type TerminalRenderStatus = (typeof TERMINAL_RENDER_STATUSES)[number]

/** A render as `statusOf` reads it (the polling fallback). */
export interface RenderState {
    /** The provider's id of the render. */
    readonly renderId: string
    /** Where it stands. */
    readonly status: RenderStatus
    /** The https address of the finished video (the provider keeps it a limited time), once `done`. */
    readonly outputUrl?: string | undefined
    /** The provider's words on a failure, once `failed`. */
    readonly error?: string | undefined
}

/** A finished render as a provider's webhook reports it: terminal, with the output or the failure. */
export interface RenderCompletion {
    /** The provider's id of the render. */
    readonly renderId: string
    /** `done` or `failed`. */
    readonly status: TerminalRenderStatus
    /** The https address of the finished video, for `done`. */
    readonly outputUrl?: string | undefined
    /** The provider's words, for `failed`. */
    readonly error?: string | undefined
}

/**
 * How a provider's webhook is proven. EVERY callback NIVO hands a provider ends with the connection's own webhook secret (the door
 * compares it in constant time: the core's rule, whatever the provider); a provider that also SIGNS its deliveries names the header
 * its official docs give (`signatureHeader`, and `timestampHeader` when it signs one) and checks it in its pure `proves`.
 */
export interface RenderWebhook {
    /** The header the provider signs a delivery in, as its docs name it; null when it signs nothing. */
    readonly signatureHeader: string | null
    /** The header of the signed timestamp, when the provider signs one; null otherwise. */
    readonly timestampHeader: string | null
}

/** A provider's webhook, or null for a provider with no webhook (its renders are read by `statusOf` alone). */
export type OptionalRenderWebhook = RenderWebhook | null

/** One delivery of a provider's render webhook as its `proves` reads it: the raw bytes and the signature headers its webhook names. */
export interface RenderWebhookDelivery {
    /** The unparsed request bytes the signature covers. */
    readonly rawBody: Buffer
    /** The value of `signatureHeader`, absent when none came. */
    readonly signature: string | undefined
    /** The value of `timestampHeader`, absent when none came. */
    readonly timestamp: string | undefined
}

/** The secrets of a connection a signature is checked against: its sealed credential (plain JSON) and its own webhook secret. */
export interface RenderWebhookSecrets {
    /** The connection's sealed credential, as stored (plain JSON). */
    readonly plain: string
    /** The connection's own webhook secret. */
    readonly webhookSecret: string
}

/** The headers of a delivery, as the HTTP door hands them (lower-case names). */
export type RenderDoorHeaders = Readonly<Record<string, string | ReadonlyArray<string> | undefined>>

/** One delivery the render door proved by its path token, as it hands it to the intake. */
export interface RenderDoorDelivery {
    /** The provider key the path names. */
    readonly provider: string
    /** The connection the path names (the scope of the proof). */
    readonly connectionId: string
    /** The unparsed request bytes, when the transport kept them. */
    readonly rawBody: Buffer | undefined
    /** The request headers. */
    readonly headers: RenderDoorHeaders
}

/** Where the provider calls back when a render ends: NIVO's render door for this connection, its webhook secret as the last segment. */
export interface RenderCallback {
    /** The https address the provider posts the finished render to. */
    readonly url: string
}

/** A callback, or null when there is none (no public origin, a provider with no webhook, a connection with no webhook secret). */
export type OptionalRenderCallback = RenderCallback | null

/** A completion, or null for a body that reports no finished render. */
export type OptionalRenderCompletion = RenderCompletion | null

/**
 * A provider that composes a video in its cloud. `start` sends the spec mapped to the provider's own body (the mapping is the adapter's,
 * from its official docs); a capability the provider lacks (a resolution, the number of clips) is a `providerRefusal` `rejected`
 * proved `not_sent` before anything leaves. `completionOf` and `proves` are PURE: no network, no clock.
 */
export interface VideoComposePort {
    /** The provider key. */
    readonly provider: string
    /** Its webhook; null for a provider with no webhook (its renders are read by `statusOf` alone). */
    readonly webhook: OptionalRenderWebhook
    /** Starts one render on one account; answers the provider's render id. */
    start(connection: ConnectionRecord, spec: ComposeSpec, callback: OptionalRenderCallback): Promise<RenderStarted>
    /** The render as it stands (`providerRefusal` `not_found` for one the account does not hold). */
    statusOf(connection: ConnectionRecord, renderId: string): Promise<RenderState>
    /** The neutral completion a webhook body reports, or null for a body that reports no finished render (a progress ping, a test). */
    completionOf(body: unknown): OptionalRenderCompletion
    /**
     * True only when the delivery carries the provider's valid signature under the connection's secrets (constant-time compare);
     * a provider that signs nothing (`signatureHeader` null) answers true: the door already proved the path's token. Never a throw.
     */
    proves(delivery: RenderWebhookDelivery, secrets: RenderWebhookSecrets): boolean
}
