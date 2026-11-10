import { Injectable } from "@nestjs/common"
import { ContextReadsService } from "@modules/domain/context-sources"
import type { ContextAudience, LockedSubject } from "@modules/domain/context-sources"
import type { GatewayJson, NativeAdapter, NativeCaller, NativeConnectorManifest } from "@modules/domain/mcp-gateway"
import { unknownTool } from "@modules/domain/mcp-gateway"
import { ConversationNativeService } from "./conversation-native.service"
import { LeadNativeService } from "./lead-native.service"
import { nativeRefusal } from "./native-refusal.policy"
import { NativeViewService } from "./native-view.service"

/** The row key of the connector of NIVO's own context reads; its public prefix is `nivo` (`nivo.<domain>.<object>.<verb>`). */
export const NIVO_CONTEXT_CONNECTOR = "nivo-context"

/** The public prefix of every NIVO native tool after the flip. */
export const NIVO_NAMESPACE = "nivo"

/** A member of the arguments as text, or null. */
const textOf = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null)

@Injectable()
/**
 * The `nivo-context` native connector (public prefix `nivo`): NIVO's own context reads (`nivo.conversation.*`, `nivo.lead.*`), each born with its final name. Every
 * read is HARD-LOCKED to the run's own conversation and customer: the conversation is the caller's (the door takes it from the run
 * token), the customer is the one that conversation names, or, for a workflow step with no conversation, the one the door filled from
 * the run token. A call naming another conversation or another customer is refused (`other_conversation`, `other_lead`) before any
 * record is read. What each read shows follows the caller's lens: a customer-facing run reads the customer's own facts only.
 */
export class NivoNativeService implements NativeAdapter {
    readonly manifest: NativeConnectorManifest

    constructor(
        private readonly reads: ContextReadsService,
        private readonly views: NativeViewService,
        private readonly conversation: ConversationNativeService,
        private readonly lead: LeadNativeService,
    ) {
        this.manifest = {
            key: NIVO_CONTEXT_CONNECTOR,
            namespace: NIVO_NAMESPACE,
            name: "NIVO",
            kind: "native",
            contractVersion: "nivo-native@1",
            tools: [...conversation.tools, ...lead.tools],
        }
    }

    /** Runs one context read for the locked subject and the caller's audience. */
    async invoke(workspaceId: string, tool: string, args: GatewayJson, caller: NativeCaller): Promise<GatewayJson> {
        const part = this.partOf(tool)
        const subject = await this.subjectOf(workspaceId, args, caller)
        const audience: ContextAudience = (await this.views.of(workspaceId, caller)).audience
        return part.read(workspaceId, tool, args, subject, audience)
    }

    private partOf(tool: string): ConversationNativeService | LeadNativeService {
        if (this.conversation.tools.some((spec) => spec.name === tool)) return this.conversation
        if (this.lead.tools.some((spec) => spec.name === tool)) return this.lead
        throw unknownTool(tool)
    }

    /**
     * The conversation and the customer the call may read: the caller's conversation and the customer it names. An id in the arguments
     * other than these is refused. With no conversation, only a workflow step reads a customer: the one the door filled from its token.
     */
    private async subjectOf(workspaceId: string, args: GatewayJson, caller: NativeCaller): Promise<LockedSubject> {
        const { conversationId } = caller
        const askedConversation = textOf(args.conversationId)
        const askedLead = textOf(args.leadId)
        if (askedConversation !== null && askedConversation !== conversationId) throw nativeRefusal("other_conversation")
        const named = conversationId === null ? null : await this.reads.leadOfConversation(workspaceId, conversationId)
        if (askedLead !== null && named !== null && askedLead !== named) throw nativeRefusal("other_lead")
        if (askedLead !== null && named === null && caller.graphStep !== true) throw nativeRefusal("other_lead")
        return { conversationId, leadId: named ?? (caller.graphStep === true ? askedLead : null) }
    }
}
