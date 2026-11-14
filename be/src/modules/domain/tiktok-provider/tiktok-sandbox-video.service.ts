import { Injectable } from "@nestjs/common"
import { PROVIDER } from "@nivo-lite/agent-sdk/names"
import type { ConnectionRecord } from "@modules/domain/connections"
import {
    providerRefusal,
    withProof,
    type TiktokCreator,
    type TiktokPublishPort,
    type TiktokPublishRequest,
    type TiktokPublishStarted,
    type TiktokPublishState,
    type TiktokPublishStatus,
} from "@modules/domain/provider-registry"
import { ProviderSandboxService } from "@modules/domain/provider-sandbox"
import {
    TIKTOK_SANDBOX_CREATOR,
    TIKTOK_SANDBOX_DEFAULT_JOB,
    TIKTOK_SANDBOX_FAILING_JOB,
    TIKTOK_SANDBOX_FAILING_TITLE,
    TIKTOK_SANDBOX_POST_ID_PREFIX,
    TIKTOK_SANDBOX_PRIVACY_REFUSAL,
    TIKTOK_SANDBOX_REFUSED_TITLES,
    type TiktokSandboxJob,
    type TiktokSandboxRefusal,
} from "./tiktok-sandbox.catalogue"

/** The sandbox operation words, the port's own method names. */
const CREATOR_OPERATION = "creator"
const PUBLISH_OPERATION = "publish"
const STATUS_OPERATION = "status"

/** State name: the posts the account started, by publish id. */
const POST = "post"

/** A started post as the account's state keeps it: its job, the public post ids once completed, and how many status reads walked the job. */
interface KeptPost {
    readonly job: TiktokSandboxJob
    readonly postIds: ReadonlyArray<string>
    readonly polls: number
}

/** Where a post stands by TikTok's documented status words alone (the live adapter's own rule). */
const stateOf = (word: string): TiktokPublishState => {
    if (word === "PUBLISH_COMPLETE") return "published"
    return word === "FAILED" ? "failed" : "pending"
}

const refusalOf = (refusal: TiktokSandboxRefusal): Error => withProof(providerRefusal(PROVIDER.tiktok, refusal.reason, refusal.detail), "not_sent")

@Injectable()
/**
 * TikTok's SANDBOX implementation of the destination port (`TiktokPublishPort`; owner rulings R56, R59, R60): used when the TikTok
 * account is a sandbox account. It answers through the generic sandbox frame from the hardcoded `TIKTOK-<n>` catalogue and never reaches
 * a host. `creator` is the fixed creator. `publish` is picked by the exact title: a named title is refused as the live twin refuses a
 * TikTok rejection or a refused token (`providerRefusal` proving `not_sent`), a privacy level the creator does not list is refused
 * `rejected`, a title that fails later and any other title are accepted and keep their post in state. The later outcome arrives by the
 * live poll: `status` walks the post's catalogue status words one per read and stays on the last (completed with the public post id, or
 * FAILED with TikTok's reason). Publish ids run `sbx-tt-publish-<n>` by the publishes the account took (`state.seq`). The sandbox adds
 * no idempotency, and a file source is not read (the sandbox has no bytes to send).
 */
export class TiktokSandboxVideoService implements TiktokPublishPort {
    /** The provider key. */
    readonly provider: string = PROVIDER.tiktok

    constructor(private readonly sandbox: ProviderSandboxService) {}

    /** The fixed creator of a sandbox account through exactly one sandbox call. */
    async creator(connection: ConnectionRecord): Promise<TiktokCreator> {
        return await this.sandbox.call(connection, CREATOR_OPERATION, {}, { answer: () => TIKTOK_SANDBOX_CREATOR })
    }

    /** Starts one post through exactly one sandbox call keyed by the title; the post is kept in state to be polled. */
    async publish(connection: ConnectionRecord, request: TiktokPublishRequest): Promise<TiktokPublishStarted> {
        return await this.sandbox.call(connection, PUBLISH_OPERATION, request, {
            key: request.title ?? "",
            answer: async (state) => {
                if (!TIKTOK_SANDBOX_CREATOR.privacyLevelOptions.includes(request.privacyLevel)) throw refusalOf(TIKTOK_SANDBOX_PRIVACY_REFUSAL)
                const refused = request.title === null ? undefined : TIKTOK_SANDBOX_REFUSED_TITLES[request.title]
                if (refused !== undefined) throw refusalOf(refused)
                const job = request.title === TIKTOK_SANDBOX_FAILING_TITLE ? TIKTOK_SANDBOX_FAILING_JOB : TIKTOK_SANDBOX_DEFAULT_JOB
                const number = String(state.seq + 1).padStart(6, "0")
                const publishId = `sbx-tt-publish-${number}`
                const kept: KeptPost = { job, postIds: job.failReason === null ? [`${TIKTOK_SANDBOX_POST_ID_PREFIX}${number}`] : [], polls: 0 }
                await state.write(POST, publishId, kept)
                return { publishId }
            },
        })
    }

    /** The post as it stands through exactly one sandbox call keyed by the publish id; each read moves the job one status word on. */
    async status(connection: ConnectionRecord, publishId: string): Promise<TiktokPublishStatus> {
        return await this.sandbox.call(connection, STATUS_OPERATION, { publishId }, {
            key: publishId,
            answer: async (state) => {
                const value = await state.read(POST, publishId)
                if (value === null) throw withProof(providerRefusal(PROVIDER.tiktok, "not_found", "publish id not found"), "not_sent")
                const kept = value as KeptPost
                const word = kept.job.words[Math.min(kept.polls, kept.job.words.length - 1)] ?? "PROCESSING_UPLOAD"
                await state.write(POST, publishId, { ...kept, polls: kept.polls + 1 })
                const done = stateOf(word) === "published"
                return {
                    publishId,
                    state: stateOf(word),
                    providerStatus: word,
                    failReason: word === "FAILED" ? kept.job.failReason : null,
                    postIds: done ? kept.postIds : [],
                }
            },
        })
    }
}
