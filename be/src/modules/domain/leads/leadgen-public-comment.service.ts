import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import { ConnectionsService } from "@modules/domain/connections"
import { DecisionsError, DecisionsErrorCode, InjectWorkPerformerRegistry } from "@modules/domain/decisions"
import type {
    Performed,
    PerformedBy,
    Prepared,
    Proposal,
    WorkContext,
    WorkItem,
    WorkPerformer,
    WorkPerformerRegistry,
} from "@modules/domain/decisions"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InjectMetaClient, MetaError, MetaErrorCode } from "@modules/integrations/meta"
import type { MetaClient, MetaPageAccess } from "@modules/integrations/meta"
import type { LeadGenPageCredentials } from "./leadgen-public-comment.contracts"
import type { LeadGenPublicCommentFlowRow } from "./persistence/leadgen-public-comment.rows"
import { FIND_LEADGEN_PUBLIC_COMMENT_FLOW } from "./persistence/leadgen-public-comment.sql"

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "")

const credentials = (plain: string): LeadGenPageCredentials => {
    try {
        const parsed: unknown = JSON.parse(plain)
        if (typeof parsed !== "object" || parsed === null) throw new MetaError({ code: MetaErrorCode.NotConfigured })
        return {
            pageId: "pageId" in parsed ? text(parsed.pageId) : "",
            pageToken: "pageToken" in parsed ? text(parsed.pageToken) : "",
        }
    } catch (cause) {
        throw new MetaError({ code: MetaErrorCode.NotConfigured, cause })
    }
}

@Injectable()
/** Performs the approved public reply through Meta and records its delivery on a stable transcript message. */
export class LeadGenPublicCommentService implements WorkPerformer, OnModuleInit {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectWorkPerformerRegistry() private readonly registry: WorkPerformerRegistry,
        @InjectMetaClient() private readonly meta: MetaClient,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly connections: ConnectionsService,
        private readonly conversations: AgentConversationsService,
        private readonly messages: AgentMessagesService,
    ) {}

    /** Replaces the generic decision-only fallback with an actual provider performer. */
    onModuleInit(): void {
        this.registry.add("reply_comment_public", this)
    }

    /** Public replies already carry the draft approved by the person. */
    prepare(_ctx: WorkContext, item: WorkItem): Promise<Prepared> {
        return Promise.resolve({ proposal: item.proposal })
    }

    /** Posts the public reply and answers success only after Meta accepts it. */
    async perform(ctx: WorkContext, item: WorkItem, proposal: Proposal, by: PerformedBy): Promise<Performed> {
        const commentId = text(proposal.fields.comment_id)
        const draft = text(proposal.draft)
        if (commentId === "" || draft === "")
            throw new DecisionsError({ code: DecisionsErrorCode.StillMissing, params: { fields: "comment_id, draft" } })
        if (item.origin !== "live") throw new DecisionsError({ code: DecisionsErrorCode.NotAllowed })
        const [flow] = await this.entityManager.query<Array<LeadGenPublicCommentFlowRow>>(
            FIND_LEADGEN_PUBLIC_COMMENT_FLOW,
            [ctx.workspaceId, item.lead_id],
        )
        const conversationId = text(proposal.fields.conversation_id) || flow?.conversation_id || ""
        const connectionId = text(proposal.fields.connection_id) || flow?.connection_id || ""
        if (conversationId === "" || connectionId === "")
            throw new DecisionsError({
                code: DecisionsErrorCode.StillMissing,
                params: { fields: "conversation_id, connection_id" },
            })
        const target = await this.conversations.turnOf(conversationId)
        if (
            target.kind !== "ok" ||
            target.value.workspaceId !== ctx.workspaceId ||
            target.value.connectionId !== connectionId ||
            target.value.leadId !== item.lead_id
        ) {
            throw new DecisionsError({ code: DecisionsErrorCode.NotAllowed })
        }
        const page = await this.pageOf(ctx.workspaceId, connectionId)
        const platform = (text(proposal.fields.platform) || flow?.platform) === "instagram" ? "instagram" : "facebook"
        const body = this.catalog.get("leads.public-comment-message", { draft }, ctx.locale)
        const messageId = await this.messages.storeHumanMessage(
            ctx.workspaceId,
            conversationId,
            body,
            by.name,
            this.entityManager,
            item.id,
        )
        const existing = await this.messages.find(messageId, conversationId)
        if (existing.kind !== "ok" || existing.value.body !== body)
            throw new DecisionsError({ code: DecisionsErrorCode.NotAllowed })
        if (existing.value.deliveryStatus !== "sent") {
            const sent = await this.meta.publicReply(page, platform, commentId, draft)
            await this.messages.markDelivery(messageId, sent.ok, sent.ok ? undefined : sent.reason)
            if (!sent.ok) throw new MetaError({ code: MetaErrorCode.Refused, params: { failure: sent.reason } })
        }
        return {
            summary: this.catalog.get("leads.public-comment-sent", {}, ctx.locale),
            evidence: "captured",
            href: item.lead_id === null ? "/chat" : "/leads/" + item.lead_id,
            lead_id: item.lead_id,
            detail: draft,
        }
    }

    private async pageOf(workspaceId: string, connectionId: string): Promise<MetaPageAccess> {
        const connection = await this.connections.get(workspaceId, connectionId)
        if (connection.provider !== "meta" || connection.status !== "connected" || connection.environment !== "live") {
            throw new DecisionsError({ code: DecisionsErrorCode.NotAllowed })
        }
        const secret = await this.connections.readSecret(connection.id)
        if (secret === null) throw new MetaError({ code: MetaErrorCode.NotConfigured })
        const page = credentials(secret.plain)
        if (page.pageId === "" || page.pageToken === "" || page.pageId !== connection.meta.page_id) {
            throw new MetaError({ code: MetaErrorCode.NotConfigured })
        }
        return { ...page, igId: connection.meta.ig_id ?? null }
    }
}
