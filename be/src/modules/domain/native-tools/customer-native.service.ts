import { Injectable } from "@nestjs/common"
import { AgentConversationsReadService } from "@modules/domain/agent-conversations"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import { LeadReadService } from "@modules/domain/leads"
import type { GatewayJson, NativeAdapter, NativeCaller, NativeConnectorManifest } from "@modules/domain/mcp-gateway"
import { CUSTOMER_BRIEF_INPUT_SCHEMA, CUSTOMER_BRIEF_SCHEMA } from "./customer-native.schema"
import { clipped, customerMasked } from "./native-masking.policy"
import { argumentsOf, nativeRefusal, unknownTool } from "./native-refusal.policy"

/** The longest need and company a brief answers, in characters. */
const TEXT_CHARS = 300

/** The customer native connector: the record of the customer an agent is talking to, for the agents on both sides of a hand-over. */
export const CUSTOMER_MANIFEST: NativeConnectorManifest = {
    key: "customer",
    name: "Customer",
    kind: "native",
    contractVersion: "customer-native@1",
    tools: [
        {
            name: "brief",
            description:
                "The customer of this conversation: where the deal stands, what they need, their company, where they came from, when they last wrote and their phone, masked.",
            scope: "read",
            defaultMode: "auto",
            inputSchema: CUSTOMER_BRIEF_INPUT_SCHEMA,
            argumentSchema: CUSTOMER_BRIEF_SCHEMA,
            secretFields: ["need", "company", "phoneMasked"],
            internalOnly: false,
        },
    ],
}

@Injectable()
/**
 * Runs `customer.brief`. The conversation is the caller's: a call without one is `not_found`, and no argument can name another
 * customer's, so one customer's record is unreachable from another's conversation. The Chatbot and Sales read the same record here;
 * neither reads the other's turns or memory.
 */
export class CustomerNativeService implements NativeAdapter {
    readonly manifest = CUSTOMER_MANIFEST

    constructor(
        private readonly conversations: AgentConversationsReadService,
        private readonly leads: LeadReadService,
        private readonly messages: AgentMessagesService,
    ) {}

    /** Runs the one customer tool. */
    async invoke(workspaceId: string, tool: string, args: GatewayJson, caller: NativeCaller): Promise<GatewayJson> {
        if (tool !== "brief") throw unknownTool(tool)
        argumentsOf(tool, CUSTOMER_BRIEF_SCHEMA, args)
        if (caller.conversationId === null) throw nativeRefusal("not_found")
        const conversation = await this.conversations.customerChat(workspaceId, caller.conversationId)
        const leadId = conversation?.leadId ?? null
        if (conversation === null || leadId === null) throw nativeRefusal("not_found")
        const [lead] = await this.leads.listByIds(workspaceId, [leadId])
        if (lead === undefined) throw nativeRefusal("not_found")
        const [contact, last] = await Promise.all([
            this.leads.contactOf(workspaceId, lead.id),
            this.messages.lastCustomerAt(conversation.id),
        ])
        return {
            stage: lead.stage,
            need: clipped(lead.need, TEXT_CHARS),
            company: clipped(lead.company, TEXT_CHARS),
            source: lead.channel,
            lastCustomerAt: last.kind === "ok" ? last.value.toISOString() : null,
            phoneMasked: customerMasked(contact?.phone ?? null),
        }
    }
}
