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
    VideoComposePort,
} from "@modules/domain/video-compose"
import {
    InjectShotstack,
    ShotstackError,
    ShotstackErrorCode,
    type ShotstackClient,
} from "@modules/integrations/shotstack"
import { SHOTSTACK_WEBHOOK, shotstackCompletionOf } from "./shotstack-callback.policy"
import { ShotstackCredentialService, shotstackEnvironmentOf } from "./shotstack-credential.service"
import { SHOTSTACK_PROVIDER, shotstackFailureOf } from "./shotstack-failure.policy"
import { shotstackEditOf, shotstackProblemsOf, shotstackStatusOf } from "./shotstack-timeline.policy"
import { DomainError } from "@modules/platform/errors"

@Injectable()
/**
 * Shotstack as the adapter of the cloud compose purpose (`VideoComposePort`): `start` POSTs the Edit mapped from the neutral spec
 * (`POST /{version}/render`) and answers the render id; `statusOf` reads `GET /{version}/render/{id}`; `completionOf` maps the render
 * callback. A spec the account's environment cannot render is refused before any request (`rejected`, proved `not_sent`).
 */
export class ShotstackComposeService implements VideoComposePort {
    /** The provider key. */
    readonly provider: string = SHOTSTACK_PROVIDER

    /** Shotstack signs nothing. */
    readonly webhook: OptionalRenderWebhook = SHOTSTACK_WEBHOOK

    constructor(
        @InjectShotstack() private readonly client: ShotstackClient,
        private readonly credentials: ShotstackCredentialService,
    ) {}

    /** Starts one render; the callback URL goes verbatim into the Edit's `callback`. */
    async start(connection: ConnectionRecord, spec: ComposeSpec, callback: OptionalRenderCallback): Promise<RenderStarted> {
        const environment = shotstackEnvironmentOf(connection)
        const problems = shotstackProblemsOf(spec, environment)
        if (problems.length > 0) throw withProof(providerRefusal(this.provider, "rejected", problems.join("; ")), "not_sent")
        const key = await this.credentials.keyOf(connection)
        const queued = await this.guarded(() => this.client.render(key, environment, shotstackEditOf(spec, callback?.url ?? null)))
        return { renderId: queued.id }
    }

    /** The render as it stands; once `done` it carries the https address, once `failed` Shotstack's reason. */
    async statusOf(connection: ConnectionRecord, renderId: string): Promise<RenderState> {
        const key = await this.credentials.keyOf(connection)
        const render = await this.guarded(() => this.client.renderStatus(key, shotstackEnvironmentOf(connection), renderId))
        const status = shotstackStatusOf(render.status)
        if (status === "done") {
            if (render.url === null) {
                throw withProof(new ShotstackError({ code: ShotstackErrorCode.Malformed, params: { what: "render url" } }), "unknown")
            }
            return { renderId: render.id, status, outputUrl: render.url }
        }
        if (status === "failed") return { renderId: render.id, status, error: render.error ?? "Shotstack did not say why the render failed." }
        return { renderId: render.id, status }
    }

    /** The completion a callback body reports, or null. */
    completionOf(body: unknown): OptionalRenderCompletion {
        return shotstackCompletionOf(body)
    }

    /** Shotstack signs nothing: the path token the door compared in constant time is the whole proof. */
    proves(_delivery: RenderWebhookDelivery): boolean {
        return true
    }

    private async guarded<T>(call: () => Promise<T>): Promise<T> {
        try {
            return await call()
        } catch (cause) {
            const failure = shotstackFailureOf(cause)
            if (failure instanceof DomainError) throw failure
            throw cause
        }
    }
}
