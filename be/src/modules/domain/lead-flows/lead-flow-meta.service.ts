import { Injectable } from "@nestjs/common"
import { ConnectionsService } from "@modules/domain/connections"
import { MetaCommentsService } from "@modules/domain/meta-comments"
import { MetaThreadsService } from "@modules/domain/meta-threads"
import { InjectMetaClient, checkPrivateReply } from "@modules/integrations/meta"
import type { MetaClient, MetaLead, MetaPageAccess, SendResult } from "@modules/integrations/meta"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { pageSecretOf } from "./lead-flow-page.policy"
import { windowStatus } from "./lead-flow-steps.policy"
import type { Platform, WindowStatus } from "./lead-flows.contracts"
import type { CommentOutcome, CommentTarget, DmOutcome, DmTarget, MentionRead, OptionalCommentOutcome, OptionalPage, OptionalText } from "./lead-flow-delivery.contracts"

const refusedDm = (reason: DmOutcome["reason"], detail: OptionalText = null): DmOutcome => ({
    ok: false,
    reason,
    detail,
})

const commentOutcomeOf = (result: SendResult): CommentOutcome =>
    result.ok
        ? { ok: true, failure: null, recipientId: result.recipientId ?? null }
        : { ok: false, failure: result.reason, recipientId: null }

@Injectable()
/**
 * The Meta door of the lead flow. The 24 hour window (and the 7 day HUMAN_AGENT window) is enforced here before every direct
 * message; a private reply to a comment is claimed once per comment, within 7 days of it, before it is sent. A refusal never
 * throws: the reason comes back for the step to explain.
 */
export class LeadFlowMetaService {
    constructor(
        @InjectMetaClient() private readonly meta: MetaClient,
        @InjectClock() private readonly clock: Clock,
        private readonly connections: ConnectionsService,
        private readonly comments: MetaCommentsService,
        private readonly threads: MetaThreadsService,
    ) {}

    /** The Page of a Meta connection of the workspace, or null when it is gone or its credential is unreadable. */
    async pageOf(workspaceId: string, connectionId: OptionalText): Promise<OptionalPage> {
        if (connectionId === null) return null
        const connection = await this.connections.find(workspaceId, connectionId)
        if (connection?.provider !== "meta" || connection.status === "disconnected") return null
        const sealed = await this.connections.readSecret(connection.id)
        const secret = sealed === null ? null : pageSecretOf(sealed.plain)
        if (secret === null) return null
        return { pageId: secret.pageId, pageToken: secret.pageToken, igId: connection.meta.ig_id ?? null }
    }

    /** The contact and answers of a Lead Ads submission; a Graph refusal throws the typed Meta error. */
    fetchLead(page: MetaPageAccess, leadgenId: string): Promise<MetaLead> {
        return this.meta.fetchLead(page, leadgenId)
    }

    /** The text and author of an Instagram mention (the webhook carries only ids). */
    async mentionOf(page: MetaPageAccess, commentId: string): Promise<MentionRead> {
        const found = await this.meta.fetchMention(page, commentId)
        return { text: found.text, username: found.username }
    }

    /** The display name Meta gives for a person, or null. */
    profileName(page: MetaPageAccess, platform: Platform, personId: string): Promise<OptionalText> {
        return this.meta.fetchProfileName(page, platform, personId)
    }

    /** Where the 24 hour window of the person of a flow stands now. */
    async windowOf(flow: DmTarget): Promise<WindowStatus> {
        const now = this.clock.now().getTime()
        const person = flow.platform === "instagram" ? flow.igsid : flow.psid
        if (flow.connection_id === null || flow.platform === null || person === null) return windowStatus(null, now)
        const last = await this.threads.lastUserAt({
            connectionId: flow.connection_id,
            platform: flow.platform,
            userId: person,
        })
        return windowStatus(last, now)
    }

    /**
     * One direct message to the person of a flow: without `humanAgent` only inside the 24 hour window, with it (a person's reply) up to 7
     * days. The text is not stored here; the caller records it with the outcome.
     */
    async sendToFlow(workspaceId: string, flow: DmTarget, text: string, humanAgent: boolean): Promise<DmOutcome> {
        const platform = flow.platform ?? "facebook"
        const recipient = platform === "instagram" ? flow.igsid : flow.psid
        if (recipient === null) return refusedDm("no_recipient")
        const window = await this.windowOf(flow)
        if (!humanAgent && window.status !== "open")
            return refusedDm(window.status === "tag_only" ? "tag_only" : "window")
        if (humanAgent && window.status === "closed") return refusedDm("window")
        const page = await this.pageOf(workspaceId, flow.connection_id)
        if (page === null) return refusedDm("not_connected")
        const via = humanAgent && window.status === "tag_only" ? "human_agent" : "standard"
        const result = await this.meta.deliverMessage(page, platform, recipient, text, via)
        return result.ok ? { ok: true, reason: null, detail: null } : refusedDm("failed", result.reason)
    }

    /** A public reply under a comment; null when no Page of the workspace can answer it. */
    async publicReply(target: CommentTarget, text: string): Promise<OptionalCommentOutcome> {
        const page = await this.pageOf(target.workspaceId, target.connectionId)
        if (page === null) return null
        return commentOutcomeOf(await this.meta.publicReply(page, target.platform, target.commentId, text))
    }

    /**
     * The one private reply to a comment, within 7 days of it: claimed before it is sent and given back when the send fails for any other
     * reason than "already answered". Null when no Page of the workspace can answer it.
     */
    async privateReply(target: CommentTarget, text: string): Promise<OptionalCommentOutcome> {
        const page = await this.pageOf(target.workspaceId, target.connectionId)
        if (page === null) return null
        const comment = { connectionId: target.connectionId, commentId: target.commentId }
        const state = await this.comments.replyState(comment)
        const verdict = checkPrivateReply(state.commentAt, state.replied, this.clock.now().getTime())
        if (!verdict.ok) return { ok: false, failure: verdict.reason, recipientId: null }
        if (!this.meta.takePrivateReplySlots(page.pageId))
            return { ok: false, failure: "rate_limited", recipientId: null }
        if (!(await this.comments.claim(comment))) return { ok: false, failure: "already_replied", recipientId: null }
        const result = await this.meta.privateMessage(page, target.platform, target.commentId, text)
        if (!result.ok && result.reason !== "already_replied") await this.comments.release(comment)
        return commentOutcomeOf(result)
    }
}
