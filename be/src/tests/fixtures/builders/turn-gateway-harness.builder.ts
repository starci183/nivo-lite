import { mock } from "@starci/jest-preset"
import type { MockOf } from "@starci/jest-preset"
import { AgentRunsService } from "@modules/domain/agent-runs"
import type { StepJson } from "@modules/domain/agent-runs"
import type { OutputNodeReader } from "@modules/domain/authority-rules"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import type { TurnConversation } from "@modules/domain/agent-conversations"
import type { ToolContext } from "@modules/domain/agent-tools"
import type { WorkItem } from "@modules/domain/decisions"
import { McpGatewayService } from "@modules/domain/mcp-gateway"
import type { TurnGatewayToolsService } from "@modules/domain/customer-turns"

/** Shared typed fixture setup for these behavior proofs. */
export const CTX: ToolContext = { jobId: "m1", workspaceId: "ws", conversationId: "c1" }
/** Shared typed fixture setup for these behavior proofs. */
export const CONVERSATION: TurnConversation = {
    id: "c1",
    workspaceId: "ws",
    channel: "zalo",
    externalId: "z1",
    connectionId: "conn",
    leadId: "l1",
    handledBy: null,
    visitorName: "Lan",
    installationId: null,
    agent: {
        id: "sales",
        name: "AI Sales",
        handle: "ai-sales",
        role: "",
        module: "chatbot",
        instructions: "",
        knowledge: "",
        approvalRule: "",
        greeting: "",
    },
    speaksAs: null,
}
/** Shared typed fixture setup for these behavior proofs. */
export const CALLER = { workspaceId: "ws", agentId: "sales", conversationId: "c1", workItemId: null }
/** Shared typed fixture setup for these behavior proofs. */
export const DESCRIBED = {
    name: "crm.order.place",
    description: "Place an order",
    scope: "write" as const,
    mode: "auto" as const,
    inputSchema: { type: "object" },
    constraints: [],
    limitVnd: null,
}
/** Shared typed fixture setup for these behavior proofs. */
export const READ = { ...DESCRIBED, name: "crm.stock.read", description: "Read stock", scope: "read" as const }
/** Shared typed fixture setup for these behavior proofs. */
export const PRICE_LIST = [{ layer: 2 as const, kind: "brain_document", ref: "src-1", label: "Price list" }]
/** Shared typed fixture setup for these behavior proofs. */
export const ORDER_SOURCE = { layer: 1, kind: "mcp_tool", ref: "crm.order.place", label: "crm.order.place" }

/** Shared typed fixture setup for these behavior proofs. */
export const SEQUENCE_STEPS = JSON.stringify([
    { name: "crm.stock.read", arguments: { sku: "a" } },
    { name: "crm.order.place", arguments: { sku: "a" } },
])

type Dependencies = ConstructorParameters<typeof TurnGatewayToolsService>

/** The graph nodes used by the real output road. */
export const CORE_NODES = { output: "act:gateway_call", approval: "ask:gateway_call", reply: "act:reply_customer" }
/** One stored output result, without executing a connector in the unit proof. */
export const roadOutputOf = (
    status: "ok" | "failed" | "held",
    code: string | null = status === "ok" ? null : "ask_mode",
): StepJson => ({
    tool: "crm.order.place",
    status,
    code,
    summary: status === "ok" ? "ORD-1" : "",
    scope: {
        conversationId: "c1",
        messageId: "m1",
        approvedBy: null,
        workItemId: null,
        planned: "",
        declined: false,
        outputNode: CORE_NODES.output,
        approvalNode: CORE_NODES.approval,
        replyNode: CORE_NODES.reply,
    },
})

interface TurnGatewayDoubles {
    readonly gateway: MockOf<McpGatewayService>
    readonly conversations: MockOf<AgentConversationsService>
    readonly approvals: MockOf<Dependencies[3]>
    readonly notes: MockOf<Dependencies[4]>
    readonly sources: MockOf<Dependencies[5]>
    readonly pipeline: MockOf<Dependencies[6]>
    readonly runs: MockOf<AgentRunsService>
    readonly nodes: MockOf<OutputNodeReader>
}

/** Configures the same kit-created dependency instances provided by the owner spec. */
export const arrangeTurnGateway = (doubles: TurnGatewayDoubles, refuses = false): void => {
    const { gateway, conversations, approvals, notes, sources, pipeline, runs, nodes } = doubles
    gateway.search.mockResolvedValue([{ name: "crm.order.place", description: "", scope: "write", mode: "auto" }])
    gateway.describe.mockResolvedValue(DESCRIBED)
    gateway.call.mockResolvedValue({ ok: true, value: { orderId: "o1" } })
    conversations.turnOf.mockResolvedValue({ kind: "ok", value: CONVERSATION })
    conversations.isTestChat.mockResolvedValue(false)
    approvals.ask.mockResolvedValue(mock<WorkItem>({ id: "w1" }))
    notes.postOnce.mockResolvedValue(undefined)
    sources.of.mockReturnValue(PRICE_LIST)
    pipeline.gateOf.mockResolvedValue({ on: refuses, refuses })
    pipeline.resultOf.mockImplementation((_gate, value) => ({ result: value }))
    runs.runInline.mockResolvedValue(roadOutputOf("ok"))
    nodes.nodesOf.mockResolvedValue(CORE_NODES)
}

/** Exact approval fields captured for one owner-gated connector call. */
export const APPROVAL_SPEC = {
    action: "gateway_call",
    subject_type: "conversation",
    subject_id: "c1",
    lead_id: "l1",
    forceAsk: "over_authority",
    seed: {
        summary: 'gatewayTurns.approvalSummary {"tool":"crm.order.place","name":"Lan","reason":"over_limit_vnd"}',
        draft: "gatewayTurns.approvedDone {}",
        fields: {
            tool: "crm.order.place",
            args_json: '{"sku":"a"}',
            customer: "Lan",
            conversation_id: "c1",
            agent_id: "sales",
            reason: "over_limit_vnd",
            sources: JSON.stringify([ORDER_SOURCE, ...PRICE_LIST]),
        },
    },
} as const

/** Identical sequence arguments with reordered object keys. */
export const SEQUENCE_ARGUMENT_CASES = {
    first: [
        { name: "crm.stock.read", arguments: { sku: "a", filter: { qty: 2, active: true } } },
        { name: "crm.order.place", arguments: { sku: "a", qty: 2 } },
    ],
    reordered: [
        { name: "crm.stock.read", arguments: { filter: { active: true, qty: 2 }, sku: "a" } },
        { name: "crm.order.place", arguments: { qty: 2, sku: "a" } },
    ],
} as const

/** Malformed or out-of-bound sequence inputs rejected before any gateway discovery. */
export const INVALID_SEQUENCES = [
    "not json",
    JSON.stringify(Array.from({ length: 11 }, () => ({ name: "crm.stock.read" }))),
    JSON.stringify([{ name: "n".repeat(114) }]),
    JSON.stringify([{ name: "crm.stock.read", arguments: [1] }]),
    JSON.stringify([{ name: "crm.stock.read", arguments: { text: "x".repeat(8193) } }]),
]

/** Exact human-approved sequence replay and its evidence source labels. */
export const SEQUENCE_APPROVAL_SEED = {
    summary:
        'gatewayTurns.approvalSummary {"tool":"crm.stock.read > crm.order.place","name":"Lan","reason":"playbook"}',
    draft: "Done for you",
    fields: {
        steps_json: SEQUENCE_STEPS,
        reason: "playbook",
        sources: JSON.stringify([
            { layer: 1, kind: "mcp_tool", ref: "crm.stock.read", label: "crm.stock.read" },
            ORDER_SOURCE,
            ...PRICE_LIST,
        ]),
    },
} as const
