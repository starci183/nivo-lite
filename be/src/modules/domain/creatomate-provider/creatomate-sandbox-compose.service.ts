import { Injectable } from "@nestjs/common"
import type { ConnectionRecord } from "@modules/domain/connections"
import { ProviderSandboxService } from "@modules/domain/provider-sandbox"
import { providerCallFailure, providerRefusal, withProof } from "@modules/domain/provider-registry"
import type {
    ComposeSpec,
    OptionalRenderCallback,
    OptionalRenderCompletion,
    OptionalRenderWebhook,
    RenderStarted,
    RenderState,
    VideoComposePort,
} from "@modules/domain/video-compose"
import { creatomateSourceOf } from "./creatomate-source.policy"
import { creatomateCompletionOf } from "./creatomate-status.policy"
import {
    CREATOMATE_SANDBOX_DEFAULT_START,
    CREATOMATE_SANDBOX_FAILED_MESSAGE,
    CREATOMATE_SANDBOX_NOT_FOUND_HINT,
    CREATOMATE_SANDBOX_NO_CREDITS_HINT,
    CREATOMATE_SANDBOX_OUTPUT_URL,
    CREATOMATE_SANDBOX_PROVIDER,
    CREATOMATE_SANDBOX_STARTS,
    creatomateSandboxRenderId,
} from "./creatomate-sandbox.catalogue"

/** The state operation that holds one started render, by its render id: its case and how many status reads it has taken. */
const RENDER_STATE = "render"

/** What the account's state keeps of a started render. */
interface KeptRender {
    readonly caseId: string
    readonly reads: number
}

/** A kept render read back, or null when the value is not one. */
const keptRenderOf = (value: unknown): KeptRender | null => {
    if (typeof value !== "object" || value === null) return null
    const caseId: unknown = Reflect.get(value, "caseId")
    const reads: unknown = Reflect.get(value, "reads")
    return typeof caseId === "string" && typeof reads === "number" ? { caseId, reads } : null
}

@Injectable()
/**
 * Creatomate's SANDBOX implementation of the compose purpose (owner rulings R56 / R59 / R60): used when the provider account is a sandbox
 * account, it answers from the hardcoded catalogue (`CREATOMATE-<n>`) and the account's state through the generic sandbox frame, and
 * never reaches a host. A start picks its case by the address of the spec's first clip; the render it answers is read back by `statusOf`
 * as a live poll would see it (queued, rendering, then the end, one step per read), or finished by the provider's webhook (the inbound
 * cases). A refusal is the error the live adapter throws for the same case; the spec is mapped by the live pure mapper first, so a spec
 * the RenderScript cannot carry is refused `rejected`, `not_sent`, as the live does.
 */
export class CreatomateSandboxComposeService implements VideoComposePort {
    /** The provider key. */
    readonly provider: string = CREATOMATE_SANDBOX_PROVIDER

    /** The same webhook as the live port: no signature header. */
    readonly webhook: OptionalRenderWebhook = { signatureHeader: null, timestampHeader: null }

    constructor(private readonly sandbox: ProviderSandboxService) {}

    /** Starts one render: refused, accepted (its render id is the next running one) or accepted with an unknown outcome. */
    start(connection: ConnectionRecord, spec: ComposeSpec, callback: OptionalRenderCallback): Promise<RenderStarted> {
        const clipUrl = spec.clips[0]?.fileUrl ?? ""
        return this.sandbox.call(
            connection,
            "start",
            { spec, callback },
            {
                key: clipUrl,
                answer: async (state) => {
                    const mapped = creatomateSourceOf(spec)
                    if (!mapped.ok) throw withProof(providerRefusal(this.provider, "rejected", mapped.problems.join("; ")), "not_sent")
                    const chosen = CREATOMATE_SANDBOX_STARTS.find((one) => one.clipUrl === clipUrl) ?? CREATOMATE_SANDBOX_DEFAULT_START
                    if (chosen.outcome === "refused") {
                        throw withProof(providerRefusal(this.provider, "rejected", CREATOMATE_SANDBOX_NO_CREDITS_HINT), "not_sent")
                    }
                    const renderId = creatomateSandboxRenderId(state.seq)
                    await state.write(RENDER_STATE, renderId, { caseId: chosen.caseId, reads: 0 })
                    if (chosen.outcome === "unknown") throw providerCallFailure("unknown")
                    return { renderId }
                },
            },
        )
    }

    /** The render as one more status read sees it; a render the account never started is the refusal `not_found`. */
    statusOf(connection: ConnectionRecord, renderId: string): Promise<RenderState> {
        return this.sandbox.call(
            connection,
            "statusOf",
            { renderId },
            {
                key: renderId,
                answer: async (state) => {
                    const kept = keptRenderOf(await state.read(RENDER_STATE, renderId))
                    const chosen = kept === null ? undefined : CREATOMATE_SANDBOX_STARTS.find((one) => one.caseId === kept.caseId)
                    if (kept === null || chosen === undefined) {
                        throw withProof(providerRefusal(this.provider, "not_found", CREATOMATE_SANDBOX_NOT_FOUND_HINT), "not_sent")
                    }
                    await state.write(RENDER_STATE, renderId, { caseId: kept.caseId, reads: kept.reads + 1 })
                    const status = chosen.polls[Math.min(kept.reads, chosen.polls.length - 1)] ?? "queued"
                    if (status === "done") return { renderId, status, outputUrl: CREATOMATE_SANDBOX_OUTPUT_URL }
                    if (status === "failed") return { renderId, status, error: CREATOMATE_SANDBOX_FAILED_MESSAGE }
                    return { renderId, status }
                },
            },
        )
    }

    /** The completion a webhook body reports: the live pure mapping. */
    completionOf(body: unknown): OptionalRenderCompletion {
        return creatomateCompletionOf(body)
    }

    /** Creatomate signs nothing, as the live port. */
    proves(): boolean {
        return true
    }
}
