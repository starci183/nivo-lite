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
    VideoComposePort,
} from "@modules/domain/video-compose"
import { InjectCreatomate, type CreatomateClient } from "@modules/integrations/creatomate"
import { CreatomateCredentialService } from "./creatomate-credential.service"
import { CREATOMATE_PROVIDER, creatomateFailureOf } from "./creatomate-failure.policy"
import { creatomateSourceOf } from "./creatomate-source.policy"
import { creatomateCompletionOf, creatomateStateOf } from "./creatomate-status.policy"
import { DomainError } from "@modules/platform/errors"

@Injectable()
/**
 * Creatomate as the adapter of the generic compose purpose (`VideoComposePort`): the neutral spec mapped to a RenderScript
 * (`creatomateSourceOf`), posted to `POST /v2/renders` with NIVO render door as `webhook_url`, read back by `GET /v2/renders/{id}`.
 * Creatomate documents NO webhook signature, so `webhook` names no header and `proves` answers true: the door path token (the
 * connection own webhook secret, constant-time) is the proof.
 */
export class CreatomateComposeService implements VideoComposePort {
    /** The provider key. */
    readonly provider: string = CREATOMATE_PROVIDER

    /** A webhook with no signature or timestamp header (none documented). */
    readonly webhook: OptionalRenderWebhook = { signatureHeader: null, timestampHeader: null }

    constructor(
        @InjectCreatomate() private readonly client: CreatomateClient,
        private readonly credentials: CreatomateCredentialService,
    ) {}

    /** Starts one render; a spec the RenderScript cannot carry is refused (`rejected`, proved `not_sent`) before any request. */
    async start(connection: ConnectionRecord, spec: ComposeSpec, callback: OptionalRenderCallback): Promise<RenderStarted> {
        const mapped = creatomateSourceOf(spec)
        if (!mapped.ok) throw withProof(providerRefusal(this.provider, "rejected", mapped.problems.join("; ")), "not_sent")
        const key = await this.credentials.keyOf(connection)
        const render = await this.guarded(() => this.client.start(key, { source: mapped.source, webhookUrl: callback?.url ?? null }))
        return { renderId: render.id }
    }

    /** The render as it stands (`GET /v2/renders/{id}`). */
    async statusOf(connection: ConnectionRecord, renderId: string): Promise<RenderState> {
        const key = await this.credentials.keyOf(connection)
        return creatomateStateOf(await this.guarded(() => this.client.render(key, renderId)))
    }

    /** The completion a webhook body reports, or null. */
    completionOf(body: unknown): OptionalRenderCompletion {
        return creatomateCompletionOf(body)
    }

    /** Creatomate signs nothing, so every delivery that reached the door (path token proven) is genuine. */
    proves(): boolean {
        return true
    }

    private async guarded<T>(work: () => Promise<T>): Promise<T> {
        try {
            return await work()
        } catch (cause) {
            const failure = creatomateFailureOf(cause)
            if (failure instanceof DomainError) throw failure
            throw cause
        }
    }
}
