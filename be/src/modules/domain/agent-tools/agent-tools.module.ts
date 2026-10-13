import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import {
    APPROVAL_REQUESTER,
    BOOKING_TOOLS,
    CONVERSATION_LEADS,
    HANDOFF_TOOL,
    KNOWLEDGE_SEARCH,
    LEAD_WRITER,
    TOOL_TOKENS,
} from "./agent-tools.decorators"
import { AgentToolsService } from "./agent-tools.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./agent-tools.module-definition"

@Module({})
/**
 * The tool bridge OpenClaw calls through: manifest, token issue and tool dispatch. The ports (knowledge, leads, booking, approvals, handoff)
 * are bound by the app root; the OpenClaw and events capabilities must be reachable from it.
 */
export class AgentToolsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const { ports } = options
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: KNOWLEDGE_SEARCH, useClass: ports.knowledgeSearch },
                { provide: LEAD_WRITER, useClass: ports.leadWriter },
                { provide: BOOKING_TOOLS, useClass: ports.bookingTools },
                { provide: APPROVAL_REQUESTER, useExisting: ports.approvalRequester },
                { provide: HANDOFF_TOOL, useClass: ports.handoffTool },
                { provide: CONVERSATION_LEADS, useClass: ports.conversationLeads },
                { provide: TOOL_TOKENS, useExisting: ports.toolTokens },
                AgentToolsService,
            ],
            exports: [AgentToolsService],
        }
    }
}
