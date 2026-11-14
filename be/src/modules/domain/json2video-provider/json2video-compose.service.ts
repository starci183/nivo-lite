import { Injectable } from "@nestjs/common"
import type { ConnectionRecord } from "@modules/domain/connections"
import { providerRefusal, withProof } from "@modules/domain/provider-registry"
import type {
    ComposeSpec,
    OptionalRenderCallback,
    OptionalRenderCompletion,
    OptionalRenderWebhook,
    RenderStarted,
    RenderState,
    RenderWebhookDelivery,
    RenderWebhookSecrets,
    VideoComposePort,
} from "@modules/domain/video-compose"
import { InjectJson2Video, type Json2VideoClient } from "@modules/integrations/json2video"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { Json2VideoCredentialService } from "./json2video-credential.service"
import { JSON2VIDEO_PROVIDER, json2videoFailureOf } from "./json2video-failure.policy"
import { movieOf } from "./json2video-movie.policy"
import { completionOf, renderStateOf } from "./json2video-status.policy"
import { DomainError } from "@modules/platform/errors"

/**
 * JSON2Video signs nothing and sends no authentication header on its webhook (https://json2video.com/docs/v2/reference/webhooks:
 * "JSON2Video does not sign webhooks"): the callback's last path segment, the connection's own webhook secret, is the proof.
 */
export const JSON2VIDEO_WEBHOOK: OptionalRenderWebhook = { signatureHeader: null, timestampHeader: null }

@Injectable()
/**
 * JSON2Video as a cloud video composer (`VideoComposePort`): the neutral spec becomes one movie JSON (a scene per clip, the audio, the
 * logo and the captions as movie-level elements, the callback as a webhook export) posted to `POST /v2/movies`; the render is read by
 * `GET /v2/movies?project=` (the polling fallback) or finished by its webhook. A spec the movie cannot carry is refused `rejected`,
 * proved `not_sent`, before any request.
 */
export class Json2VideoComposeService implements VideoComposePort {
    /** The provider key. */
    readonly provider: string = JSON2VIDEO_PROVIDER

    /** The webhook: unsigned. */
    readonly webhook: OptionalRenderWebhook = JSON2VIDEO_WEBHOOK

    constructor(
        @InjectJson2Video() private readonly client: Json2VideoClient,
        private readonly credentials: Json2VideoCredentialService,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Starts one render (`POST /v2/movies`); the callback goes verbatim into the webhook destination. */
    async start(connection: ConnectionRecord, spec: ComposeSpec, callback: OptionalRenderCallback): Promise<RenderStarted> {
        const built = movieOf(spec, callback)
        if (!built.ok) throw withProof(providerRefusal(this.provider, "rejected", built.reason), "not_sent")
        const key = await this.credentials.keyOf(connection)
        const started = await this.guarded(() => this.client.create(key, built.movie))
        return { renderId: started.project }
    }

    /** The render as it stands (`GET /v2/movies?project=`). */
    async statusOf(connection: ConnectionRecord, renderId: string): Promise<RenderState> {
        const key = await this.credentials.keyOf(connection)
        const movie = await this.guarded(() => this.client.movie(key, renderId))
        return renderStateOf(movie, this.clock.now())
    }

    /** The completion a webhook body reports (pure). */
    completionOf(body: unknown): OptionalRenderCompletion {
        return completionOf(body)
    }

    /** JSON2Video signs nothing: the door's path token already proved the delivery. */
    proves(_delivery: RenderWebhookDelivery, _secrets: RenderWebhookSecrets): boolean {
        return true
    }

    private async guarded<T>(call: () => Promise<T>): Promise<T> {
        try {
            return await call()
        } catch (cause) {
            const failure = json2videoFailureOf(cause)
            if (failure instanceof DomainError) throw failure
            throw cause
        }
    }
}
