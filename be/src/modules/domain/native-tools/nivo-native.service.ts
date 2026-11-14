import { Injectable } from "@nestjs/common"
import { ConversationContactsService } from "@modules/domain/contacts"
import type { ContextAudience, LockedSubject } from "@modules/domain/context-sources"
import {
    type ToolJson,
    type NativeToolFamily,
    type NativeCaller,
    type ToolManifest,
    NIVO_TOOL_PREFIX,
    unknownTool,
} from "@modules/domain/tools"
import { nativeRefusal } from "./native-refusal.policy"
import { NativeViewService } from "./native-view.service"
import { PluginToolsNativeService } from "./plugin-tools-native.service"

/** The row key of the connector of NIVO's own context reads; its public prefix is `nivo.tool` (`nivo.tool.<domain>.<object>.<verb>`). */
export const NIVO_CONTEXT_CONNECTOR = "nivo-context"

/** A member of the arguments as text, or null. */
const textOf = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null)

@Injectable()
/**
 * The `nivo-context` native connector (public prefix `nivo.tool`): the context reads the installed plugins serve through the `PLUGIN_TOOLS` contract, listed from the installation (the thread read `nivo.tool.conversation.message.list` is the chatbot module's own), each born with its final name. Every
 * read is HARD-LOCKED to the run's own conversation and person: the conversation is the caller's (the door takes it from the run
 * token), the person (the contact) is the one that conversation names, or, for a workflow step with no conversation, the one the door
 * filled from the run token; the sales lead a module resolved (the bridge of the care read) is only the door's fill for a workflow step.
 * A call naming another conversation, person or lead is refused (`other_conversation`, `other_contact`, `other_lead`) before any record
 * is read. What each read shows follows the caller's lens: a customer-facing run reads the customer's own facts only.
 */
export class NivoNativeService implements NativeToolFamily {
    /** The tool manifest of the nivo-context connector: the reads the installed plugins serve (the thread read among them, served by the chatbot module). */
    readonly manifest: ToolManifest

    constructor(
        private readonly contacts: ConversationContactsService,
        private readonly views: NativeViewService,
        private readonly plugins: PluginToolsNativeService,
    ) {
        this.manifest = {
            key: NIVO_CONTEXT_CONNECTOR,
            namespace: NIVO_TOOL_PREFIX,
            name: "NIVO",
            contractVersion: "nivo-native@1",
            tools: [...plugins.tools],
        }
    }

    /** Runs one context read for the locked subject and the caller's audience. */
    async invoke(workspaceId: string, tool: string, args: ToolJson, caller: NativeCaller): Promise<ToolJson> {
        if (!this.plugins.serves(tool)) throw unknownTool(tool)
        const subject = await this.subjectOf(workspaceId, args, caller)
        const audience: ContextAudience = (await this.views.of(workspaceId, caller)).audience
        return this.plugins.read(workspaceId, tool, args, subject, audience, caller.agentId)
    }

    /**
     * The conversation and the person the call may read: the caller's conversation (a ROUTE) and the contact the route reaches.
     * An id in the arguments other than these is refused. Where the route names no person (none), only a workflow step reads a person: the one the door filled from its token. The sales lead is
     * only ever the one the door filled for a workflow step.
     */
    private async subjectOf(workspaceId: string, args: ToolJson, caller: NativeCaller): Promise<LockedSubject> {
        const { conversationId } = caller
        const askedConversation = textOf(args.conversationId)
        const askedContact = textOf(args.contactId)
        const askedLead = textOf(args.leadId)
        if (askedConversation !== null && askedConversation !== conversationId) throw nativeRefusal("other_conversation")
        const named =
            conversationId === null ? null : await this.contacts.contactOf(workspaceId, conversationId)
        if (askedContact !== null && named !== null && askedContact !== named) throw nativeRefusal("other_contact")
        if (askedContact !== null && named === null && caller.graphStep !== true) throw nativeRefusal("other_contact")
        if (askedLead !== null && caller.graphStep !== true) throw nativeRefusal("other_lead")
        return {
            conversationId,
            contactId: named ?? (caller.graphStep === true ? askedContact : null),
            leadId: caller.graphStep === true ? askedLead : null,
        }
    }
}
