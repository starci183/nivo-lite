import { Injectable } from "@nestjs/common"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import type { TurnConversation } from "@modules/domain/agent-conversations"
import type { GatewayTools, GatewayToolName, JsonResult, ToolArgs, ToolContext } from "@modules/domain/agent-tools"
import { WorkEngineService } from "@modules/domain/decisions"
import { argsHashOf, McpGatewayService } from "@modules/domain/mcp-gateway"
import type { GatewayCaller, GatewayJson } from "@modules/domain/mcp-gateway"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { parseJsonText } from "@modules/platform/primitives"
import { GATEWAY_STEPS_MAX, gatewayStepsOf } from "@modules/domain/work-performers"
import type { HubNoteSource } from "./gateway-turns.contracts"
import { HubNotesService, toolSourcesOf } from "./hub-notes.service"
import { TurnSourcesService } from "./turn-sources.service"

const LOCALE = "vi"
/** Who the engine names as the actor of an approval a turn opened. */
const ENGINE_ACTOR = "OpenClaw"
/** The action of a gated call's approval; the gateway-call performer replays it once a person approves. */
const GATEWAY_CALL_ACTION = "gateway_call"
/** How many tools a search answers when the agent names no limit, and at most. */
const SEARCH_LIMIT_DEFAULT = 5
const SEARCH_LIMIT_MAX = 10
/** The longest search query and tool name the bridge passes on, and the longest reply a sequence keeps. */
const TEXT_MAX = 200
const REPLY_MAX = 2000
/** The answer of a test chat's write: nothing reaches the connector. */
const SIMULATION: JsonResult = { error: "simulation", detail: "a test chat runs connector tools read-only" }

/** What the approval of a held call or sequence carries besides the conversation. */
interface ApprovalSeed {
    /** The step key the approval is deduplicated by. */
    readonly stepKey: string
    /** What the summary names: one tool, or the tools of the sequence. */
    readonly tool: string
    /** Why it needs a person. */
    readonly reason: string
    /** What the customer hears once approved. */
    readonly draft: string
    /** The fields that say what to replay: the tool and its arguments, or the steps. */
    readonly replay: Readonly<Record<string, string>>
    /** The tools the approval would run. */
    readonly tools: ReadonlyArray<string>
}

const isObject = (value: unknown): value is GatewayJson =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const textOf = (value: unknown, max: number = TEXT_MAX): string =>
    typeof value === "string" ? value.trim().slice(0, max) : ""

const limitOf = (value: unknown): number =>
    typeof value === "number" && Number.isInteger(value) && value >= 1
        ? Math.min(value, SEARCH_LIMIT_MAX)
        : SEARCH_LIMIT_DEFAULT

/** The JSON a text argument carries, or undefined when it is no JSON; an absent or blank text is null. */
const jsonOf = (value: unknown): unknown => {
    const text = typeof value === "string" ? value.trim() : ""
    if (text === "") return null
    const read = parseJsonText(text)
    return read.ok ? read.value : undefined
}

/** The arguments of a call: none when the agent sent none, null when what it sent is no JSON object. */
const argumentsOf = (value: unknown): GatewayJson | null => {
    const parsed = jsonOf(value)
    if (parsed === null) return {}
    return isObject(parsed) ? parsed : null
}

/** A canonical argument digest: retries ignore object key order, while changed values and array order keep distinct steps. */
const digestOf = (value: GatewayJson): string => argsHashOf(value).slice(0, 16)

@Injectable()
/**
 * The connector meta-tools of a customer turn, served to OpenClaw through the tool bridge: `tool.search`, `tool.describe`,
 * `tool.call` and `tool.sequence` run through the MCP gateway as the conversation's own agent, so its grants, the approved schemas,
 * the breaker and the audit apply. NIVO names no connector and no tool here: which tools to call and in which order comes from the
 * business knowledge. A call over the agent's limits, and every sequence (the playbook steps a person approves at once), opens the
 * `gateway_call` approval with the exact arguments and the turn's sources, and the agent hears `approval_requested`. A write the agent
 * made posts an `action_done` card. An owner's test chat runs read-only: search, describe and read-scope calls run for real, while a
 * write-scope call or sequence is refused with a typed `simulation` answer before it reaches the connector.
 */
export class TurnGatewayToolsService implements GatewayTools {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly gateway: McpGatewayService,
        private readonly conversations: AgentConversationsService,
        private readonly engine: WorkEngineService,
        private readonly notes: HubNotesService,
        private readonly sources: TurnSourcesService,
    ) {}

    /** Runs one meta-tool for the job's own conversation; a conversation of another workspace answers not found. */
    async run(ctx: ToolContext, tool: GatewayToolName, args: ToolArgs): Promise<JsonResult> {
        const turn = await this.conversations.turnOf(ctx.conversationId)
        if (turn.kind === "refused" || turn.value.workspaceId !== ctx.workspaceId) {
            return { error: "conversation_not_found" }
        }
        const conversation = turn.value
        const caller: GatewayCaller = {
            workspaceId: ctx.workspaceId,
            agentId: conversation.agent.id,
            conversationId: conversation.id,
            workItemId: null,
        }
        if (tool === "tool.search") {
            return { tools: await this.gateway.search(caller, textOf(args.query), limitOf(args.limit)) }
        }
        if (tool === "tool.describe") {
            const described = await this.gateway.describe(caller, textOf(args.name))
            return described === null ? { error: "not_granted_or_unknown" } : { ...described }
        }
        if (tool === "tool.sequence") return this.sequence(ctx, conversation, caller, args)
        return this.call(ctx, conversation, caller, args)
    }

    /** Calls one tool under the step key of the job; a call that needs a person becomes its approval, a write posts its card. */
    private async call(
        ctx: ToolContext,
        conversation: TurnConversation,
        caller: GatewayCaller,
        args: ToolArgs,
    ): Promise<JsonResult> {
        const name = textOf(args.name)
        const callArgs = argumentsOf(args.arguments_json)
        if (callArgs === null) return { error: "invalid_arguments", detail: "arguments_json is not a JSON object" }
        const described = await this.gateway.describe(caller, name)
        const writes = described?.scope !== "read"
        if (writes && (await this.conversations.isTestChat(conversation.id))) return SIMULATION
        const stepKey = `${ctx.jobId}:${name}:${digestOf(callArgs)}`
        const result = await this.gateway.call({ ...caller, opKey: stepKey }, name, callArgs)
        if (result.ok) {
            if (described !== null && writes)
                await this.postDone(ctx, conversation, name, described.description, stepKey)
            return { result: result.value }
        }
        if (result.code !== "approval_required") return { error: result.code, detail: result.detail }
        return this.ask(ctx, conversation, {
            stepKey,
            tool: name,
            reason: result.reason,
            draft: this.catalog.get("gatewayTurns.approvedDone", {}, LOCALE),
            replay: { tool: name, args_json: JSON.stringify(callArgs) },
            tools: [name],
        })
    }

    /**
     * Holds a sequence of granted calls (the playbook's steps) for one person's approval: nothing runs before it, then the
     * gateway-call performer runs the steps in order and tells the customer the reply.
     */
    private async sequence(
        ctx: ToolContext,
        conversation: TurnConversation,
        caller: GatewayCaller,
        args: ToolArgs,
    ): Promise<JsonResult> {
        const steps = gatewayStepsOf(args.steps_json)
        if (steps === null) {
            return { error: "invalid_steps", detail: `steps_json is a list of 1 to ${String(GATEWAY_STEPS_MAX)} calls` }
        }
        const described = await Promise.all(steps.map((step) => this.gateway.describe(caller, step.name)))
        const unknown = steps.find((_step, index) => described[index] === null)
        if (unknown !== undefined) return { error: "not_granted_or_unknown", detail: unknown.name }
        const writes = described.some((tool) => tool?.scope !== "read")
        if (writes && (await this.conversations.isTestChat(conversation.id))) return SIMULATION
        const names = steps.map((step) => step.name)
        const reply = textOf(args.reply, REPLY_MAX)
        return this.ask(ctx, conversation, {
            stepKey: `${ctx.jobId}:sequence:${digestOf({ steps })}`,
            tool: names.join(" > "),
            reason: "playbook",
            draft: reply === "" ? this.catalog.get("gatewayTurns.approvedDone", {}, LOCALE) : reply,
            replay: { steps_json: JSON.stringify(steps) },
            tools: names,
        })
    }

    /** Opens the `gateway_call` approval of a held call or sequence with the turn's sources, and tells the agent it was asked. */
    private async ask(ctx: ToolContext, conversation: TurnConversation, seed: ApprovalSeed): Promise<JsonResult> {
        const item = await this.engine.runWork(
            { workspaceId: ctx.workspaceId, actor: ENGINE_ACTOR, locale: LOCALE },
            {
                action: GATEWAY_CALL_ACTION,
                subject_type: "conversation",
                subject_id: conversation.id,
                lead_id: conversation.leadId,
                preset: true,
                noChain: true,
                forceAsk: "over_authority",
                dedupeKey: `${GATEWAY_CALL_ACTION}:${seed.stepKey}`,
                seed: {
                    summary: this.catalog.get(
                        "gatewayTurns.approvalSummary",
                        { tool: seed.tool, name: conversation.visitorName ?? "-", reason: seed.reason },
                        LOCALE,
                    ),
                    draft: seed.draft,
                    fields: {
                        ...seed.replay,
                        customer: conversation.visitorName ?? "",
                        conversation_id: conversation.id,
                        agent_id: conversation.agent.id,
                        reason: seed.reason,
                        sources: JSON.stringify(this.sourcesOf(ctx, seed.tools)),
                    },
                },
            },
        )
        return { status: "approval_requested", reason: seed.reason, work_item_id: item.id }
    }

    /** The `action_done` card of a write the agent made, in its home room, with the tool and the turn's knowledge as sources. */
    private async postDone(
        ctx: ToolContext,
        conversation: TurnConversation,
        name: string,
        description: string,
        stepKey: string,
    ): Promise<void> {
        await this.notes.postOnce(
            {
                workspaceId: conversation.workspaceId,
                room: "",
                type: "action_done",
                title: this.catalog.get("gatewayTurns.cardActionDone", { what: description || name }, LOCALE),
                fields: [
                    { label: this.catalog.get("gatewayTurns.field.tool", {}, LOCALE), value: name },
                    {
                        label: this.catalog.get("gatewayTurns.field.customer", {}, LOCALE),
                        value: conversation.visitorName ?? "",
                    },
                ],
                authorName: conversation.agent.name,
                sources: this.sourcesOf(ctx, [name]),
            },
            conversation.agent.id,
            { leadId: conversation.leadId, workItemId: null },
            stepKey,
        )
    }

    /** The tools a card names (layer 1), then the knowledge the turn read (layers 2 and 4). */
    private sourcesOf(ctx: ToolContext, tools: ReadonlyArray<string>): ReadonlyArray<HubNoteSource> {
        return [...toolSourcesOf(tools), ...this.sources.of(ctx.jobId)]
    }
}
