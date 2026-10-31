import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import {
    AGENT_HANDOFF,
    APPROVAL_REQUESTER,
    BOOKING_TOOLS,
    BRIDGE_TURNS,
    CONVERSATION_LEADS,
    GATEWAY_TOOLS,
    HANDOFF_TOOL,
    INTERNAL_TOOLS,
    KNOWLEDGE_SEARCH,
    LEAD_WRITER,
    TOOL_TOKENS,
} from "./agent-tools.decorators"
import { AgentToolsService } from "./agent-tools.service"
import { BridgeCallsService } from "./bridge-calls.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./agent-tools.module-definition"

@Module({})
/**
 * The tool bridge OpenClaw calls through: manifest, token issue and tool dispatch. The ports (knowledge, leads, booking, approvals, handoffs, connector meta-tools)
 * are bound by the app root, and so are the two ports that serve the OpenClaw bridge plugin (the running turn of a call, the connector tools of a turn with no conversation); the OpenClaw and events capabilities must be reachable from it.
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
                { provide: GATEWAY_TOOLS, useExisting: ports.gatewayTools },
                { provide: AGENT_HANDOFF, useExisting: ports.agentHandoff },
                { provide: TOOL_TOKENS, useExisting: ports.toolTokens },
                { provide: BRIDGE_TURNS, useExisting: ports.bridgeTurns },
                { provide: INTERNAL_TOOLS, useExisting: ports.internalTools },
                BridgeCallsService,
                AgentToolsService,
            ],
            exports: [AgentToolsService],
        }
    }
}
