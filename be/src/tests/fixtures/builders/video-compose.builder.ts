import { timingSafeEqual } from "node:crypto"
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

/** The provider key of the fake compose service. */
export const FAKE_COMPOSE = "fakecompose"

/** A finished render's address at the fake service. */
export const FAKE_OUTPUT = "https://cdn.fakecompose.test/renders/r-1.mp4"

/** An account of the fake compose service. */
export const composeAccountOf = (id: string = "4f0c2a8e-0d4b-4c43-9a51-0c7a8a5a0c01", provider: string = FAKE_COMPOSE): ConnectionRecord =>
    ({ id, workspaceId: "ws-1", provider, name: "Compose", meta: {} }) as unknown as ConnectionRecord

/** A spec the fake service renders. */
export const SOUND_SPEC: ComposeSpec = {
    clips: [
        { fileUrl: "https://store.test/c1.mp4?sig=a" },
        { fileUrl: "https://store.test/c2.mp4?sig=b", trimMs: { fromMs: 500, toMs: 4000 } },
    ],
    audio: [
        { fileUrl: "https://store.test/voice.mp3?sig=c", role: "voice" },
        { fileUrl: "https://store.test/bed.mp3?sig=d", role: "music", volume: 0.3 },
    ],
    logo: { fileUrl: "https://store.test/logo.png?sig=e", corner: "top-right" },
    captions: [{ text: "Lotus", fromMs: 0, toMs: 2000 }],
    aspect: "9:16",
    resolution: "hd",
}

/** The fake service's webhook: no signature (the door's path token alone proves it). */
export const FAKE_UNSIGNED: OptionalRenderWebhook = { signatureHeader: null, timestampHeader: null }

/** The fake service's webhook when it signs: header `x-fake-signature` equal to the account's credential. */
export const FAKE_SIGNED: OptionalRenderWebhook = { signatureHeader: "x-fake-signature", timestampHeader: null }

/** The webhook body of the fake service: its own words (`state`, `url`, `message`), mapped by the fake's `completionOf`. */
export interface FakeComposeHook {
    readonly id?: unknown
    readonly state?: unknown
    readonly url?: unknown
    readonly message?: unknown
}

/** What the fake was asked to render. */
export interface FakeStarted {
    readonly spec: ComposeSpec
    readonly callback: OptionalRenderCallback
}

/**
 * A compose provider with no network: `start` keeps what it was asked and answers render ids `r-1`, `r-2`...; it refuses a `1080` spec
 * as its official docs would (`rejected`, proved `not_sent`), an account named `bad` (`auth_refused`); signing (`FAKE_SIGNED`), its
 * signature header must equal the credential. Its webhook words: `rendering`, `succeeded`, `failed`.
 */
export class FakeComposePort implements VideoComposePort {
    readonly started: Array<FakeStarted> = []

    constructor(
        readonly provider: string = FAKE_COMPOSE,
        readonly webhook: OptionalRenderWebhook = FAKE_UNSIGNED,
        private readonly states: Readonly<Record<string, RenderState>> = {},
    ) {}

    start(connection: ConnectionRecord, spec: ComposeSpec, callback: OptionalRenderCallback): Promise<RenderStarted> {
        if (connection.name === "bad") return Promise.reject(withProof(providerRefusal(this.provider, "auth_refused"), "not_sent"))
        if (spec.resolution === "1080") {
            return Promise.reject(withProof(providerRefusal(this.provider, "rejected", "1080 is not offered on this plan"), "not_sent"))
        }
        this.started.push({ spec, callback })
        return Promise.resolve({ renderId: `r-${this.started.length}` })
    }

    statusOf(_connection: ConnectionRecord, renderId: string): Promise<RenderState> {
        const state = this.states[renderId]
        return state === undefined ? Promise.reject(providerRefusal(this.provider, "not_found")) : Promise.resolve(state)
    }

    completionOf(body: unknown): OptionalRenderCompletion {
        const hook = (typeof body === "object" && body !== null ? body : {}) as FakeComposeHook
        if (typeof hook.id !== "string") return null
        if (hook.state === "succeeded" && typeof hook.url === "string") return { renderId: hook.id, status: "done", outputUrl: hook.url }
        if (hook.state === "failed") {
            return { renderId: hook.id, status: "failed", ...(typeof hook.message === "string" ? { error: hook.message } : {}) }
        }
        return null
    }

    proves(delivery: RenderWebhookDelivery, secrets: RenderWebhookSecrets): boolean {
        if ((this.webhook?.signatureHeader ?? null) === null) return true
        if (delivery.signature === undefined) return false
        const given = Buffer.from(delivery.signature)
        const held = Buffer.from(secrets.plain)
        return given.length === held.length && timingSafeEqual(given, held)
    }
}
