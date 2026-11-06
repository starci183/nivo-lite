import { Injectable, Optional } from "@nestjs/common"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import type { TurnConversation } from "@modules/domain/agent-conversations"
import type { GatewayTools, GatewayToolName, JsonResult, ToolArgs, ToolContext } from "@modules/domain/agent-tools"
import { AgentRunsService } from "@modules/domain/agent-runs"
import { InjectOutputNodeReader } from "@modules/domain/authority-rules"
import type { OutputNodeReader, OutputNodes } from "@modules/domain/authority-rules"
import type { WorkSpec } from "@modules/domain/decisions"
import {
    argsHashOf,
    gatewayArgumentsSchema,
    gatewayDescribeSchema,
    gatewaySearchSchema,
    McpGatewayService,
} from "@modules/domain/mcp-gateway"
import type { GatewayCaller, GatewayJson, OptionalDescribedTool } from "@modules/domain/mcp-gateway"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { parseJsonText } from "@modules/platform/primitives"
import type { HubNoteSource } from "./gateway-turns.contracts"
import { HubNotesService, toolSourcesOf } from "./hub-notes.service"
import type { PipelineGate } from "./customer-intent.contracts"
import { TurnGatewayPipelineService } from "./turn-gateway-pipeline.service"
import {
    gatewaySequenceStepsSchema,
    turnGatewayCallSchema,
    turnGatewaySequenceSchema,
} from "./turn-gateway-tools.schema"
import { OutputApprovalService } from "./output-approval.service"
import { outputSpecOf, outputStepFrom } from "./output-steps.policy"
import type { HeldCall, OutputScope } from "./output-steps.schema"
import { TurnSourcesService } from "./turn-sources.service"

const LOCALE = "vi"
/** Who the engine names as the actor of an approval a turn opened. */
const ENGINE_ACTOR = "OpenClaw"
/** The action of a gated call's approval; the gateway-call performer replays it once a person approves. */
const GATEWAY_CALL_ACTION = "gateway_call"
/** How long one output step may run inside a turn. */
const OUTPUT_STEP_MS = 30_000
/** How many tools a search answers when the agent names no limit. */
const SEARCH_LIMIT_DEFAULT = 5
/** The answer of a write in a turn that is not pinned to the intent that owns it: the write waits for a turn of its own. */
const NEEDS_OWN_TURN: JsonResult = { error: "needs_own_turn" }
/** The answer of a test chat's write: nothing reaches the connector. */
const SIMULATION: JsonResult = { error: "simulation", detail: "a test chat runs connector tools read-only" }

/** The nodes of a graph that draws no output. */
const NO_NODES: OutputNodes = { output: "", approval: "", reply: "" }

/** One write of a turn, as its output step runs it. */
interface OutputCallRequest {
    /** The full name of the tool. */
    readonly name: string
    /** The arguments. */
    readonly args: GatewayJson
    /** The replay key the receipt is claimed under. */
    readonly stepKey: string
    /** The tool as the agent sees it, or null when it is not granted. */
    readonly described: OptionalDescribedTool
}

/** What the approval of a held call or sequence carries besides the conversation. */
interface ApprovalSeed {
    /** The step key the approval is deduplicated by. */
    readonly stepKey: string
    /** What the summary names: one tool, or the tools of the sequence. */
    readonly tool: string
    /** Why it needs a person. */
    readonly reason: string
    /** What the agent plans to say once approved; the final reply is written from what really happened. */
    readonly draft: string
    /** The fields that say what to replay: the tool and its arguments, or the steps. */
    readonly replay: Readonly<Record<string, string>>
    /** The tools the approval would run. */
    readonly tools: ReadonlyArray<string>
    /** The exact calls, which the run keeps until a person answers. */
    readonly calls: ReadonlyArray<HeldCall>
}

/** The arguments of a call: none when the agent sent none, null when what it sent is no JSON object. */
const argumentsOf = (value: string | undefined): GatewayJson | null => {
    if (value === undefined || value.trim() === "") return {}
    const read = parseJsonText(value)
    if (!read.ok) return null
    const parsed = gatewayArgumentsSchema.safeParse(read.value)
    return parsed.success ? parsed.data : null
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
 * made posts an `action_done` card and leaves what it came to on its run, which the final reply of the turn reads. An owner's test chat
 * runs read-only: search, describe and read-scope calls run for real, while a write-scope call or sequence is refused with a typed
 * `simulation` answer before it reaches the connector. On the contract pipeline a write or a sequence of an unpinned turn is refused with
 * `needs_own_turn`, and a call's result reaches the model as marked data.
 */
export class TurnGatewayToolsService implements GatewayTools {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly gateway: McpGatewayService,
        private readonly conversations: AgentConversationsService,
        private readonly approvals: OutputApprovalService,
        private readonly notes: HubNotesService,
        private readonly sources: TurnSourcesService,
        private readonly pipeline: TurnGatewayPipelineService,
        private readonly runs: AgentRunsService,
        @Optional() @InjectOutputNodeReader() private readonly nodes: OutputNodeReader | null = null,
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
            const parsed = gatewaySearchSchema.safeParse(args)
            if (!parsed.success) return { error: "invalid_arguments" }
            return {
                tools: await this.gateway.search(
                    caller,
                    parsed.data.query.trim(),
                    parsed.data.limit ?? SEARCH_LIMIT_DEFAULT,
                ),
            }
        }
        if (tool === "tool.describe") {
            const parsed = gatewayDescribeSchema.safeParse(args)
            if (!parsed.success) return { error: "invalid_arguments" }
            const described = await this.gateway.describe(caller, parsed.data.name.trim())
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
        const parsed = turnGatewayCallSchema.safeParse(args)
        if (!parsed.success) return { error: "invalid_arguments" }
        const name = parsed.data.name.trim()
        const callArgs = argumentsOf(parsed.data.arguments_json)
        if (callArgs === null) return { error: "invalid_arguments", detail: "arguments_json is not a JSON object" }
        const described = await this.gateway.describe(caller, name)
        const writes = described?.scope !== "read"
        if (writes && (await this.conversations.isTestChat(conversation.id))) return SIMULATION
        const gate = await this.pipeline.gateOf(ctx, conversation)
        if (gate.refuses && described !== null && writes) return NEEDS_OWN_TURN
        const stepKey = `${ctx.jobId}:${name}:${digestOf(callArgs)}`
        if (writes && ctx.wakeId !== undefined) {
            return this.output(ctx, ctx.wakeId, conversation, gate, { name, args: callArgs, stepKey, described })
        }
        const result = await this.gateway.call({ ...caller, opKey: stepKey }, name, callArgs)
        if (result.ok) {
            if (described !== null && writes)
                await this.postDone(ctx, conversation, name, described.description, stepKey)
            return this.pipeline.resultOf(gate, result.value)
        }
        if (result.code !== "approval_required") return { error: result.code, detail: result.detail }
        return this.ask(ctx, conversation, {
            stepKey,
            tool: name,
            reason: result.reason,
            draft: this.catalog.get("gatewayTurns.approvedDone", {}, LOCALE),
            replay: { tool: name, args_json: JSON.stringify(callArgs) },
            tools: [name],
            calls: [{ tool: name, argsJson: JSON.stringify(callArgs) }],
        })
    }

    /**
     * Runs a write as the output step of the turn's run: a replay answers the stored result and never calls the tool again, and the model
     * reads the masked summary. What the customer hears is the final reply, written from that result after the turn.
     */
    private async output(
        ctx: ToolContext,
        wakeId: string,
        conversation: TurnConversation,
        gate: PipelineGate,
        call: OutputCallRequest,
    ): Promise<JsonResult> {
        const { name, args, stepKey, described } = call
        const spec = outputSpecOf(
            { stepKey: `output:${name}:${digestOf(args)}`, tool: name, argsJson: JSON.stringify(args), opKey: stepKey },
            [],
            await this.scopeOf(ctx, conversation, ""),
        )
        const stored = outputStepFrom(
            await this.runs.runInline(ctx.workspaceId, wakeId, spec, AbortSignal.timeout(OUTPUT_STEP_MS)),
        )
        if (stored === null) return { error: "unknown_outcome" }
        if (stored.status === "failed") return { error: stored.code ?? "failed", detail: stored.summary }
        if (stored.status === "ok") {
            if (described !== null) await this.postDone(ctx, conversation, name, described.description, stepKey)
            return this.pipeline.resultOf(gate, { summary: stored.summary })
        }
        return this.ask(ctx, conversation, {
            stepKey,
            tool: name,
            reason: stored.code ?? "",
            draft: this.catalog.get("gatewayTurns.approvedDone", {}, LOCALE),
            replay: { tool: name, args_json: JSON.stringify(args) },
            tools: [name],
            calls: [{ tool: name, argsJson: JSON.stringify(args) }],
        })
    }

    /** Where an output of the turn runs, on the nodes of the published graph. */
    private async scopeOf(ctx: ToolContext, conversation: TurnConversation, planned: string): Promise<OutputScope> {
        const nodes = (await this.nodes?.nodesOf(ctx.workspaceId, conversation.agent.id)) ?? NO_NODES
        return {
            conversationId: conversation.id,
            messageId: ctx.jobId,
            approvedBy: null,
            workItemId: null,
            planned,
            declined: false,
            outputNode: nodes.output,
            approvalNode: nodes.approval,
            replyNode: nodes.reply,
        }
    }

    /**
     * Holds a sequence of granted calls (the playbook's steps) for one person's approval: nothing runs before it, then the
     * gateway-call performer runs the steps in order and the customer hears the final reply.
     */
    private async sequence(
        ctx: ToolContext,
        conversation: TurnConversation,
        caller: GatewayCaller,
        args: ToolArgs,
    ): Promise<JsonResult> {
        const parsed = turnGatewaySequenceSchema.safeParse(args)
        if (!parsed.success) return { error: "invalid_arguments" }
        const read = parseJsonText(parsed.data.steps_json)
        const decoded = gatewaySequenceStepsSchema.safeParse(read.ok ? read.value : null)
        if (!decoded.success) return { error: "invalid_steps", detail: "steps_json is a list of 1 to 10 bounded calls" }
        const steps = decoded.data.map((step) => ({ name: step.name.trim(), arguments: step.arguments ?? {} }))
        const described = await Promise.all(steps.map((step) => this.gateway.describe(caller, step.name)))
        const unknown = steps.find((_step, index) => described[index] === null)
        if (unknown !== undefined) return { error: "not_granted_or_unknown", detail: unknown.name }
        const writes = described.some((tool) => tool?.scope !== "read")
        if (writes && (await this.conversations.isTestChat(conversation.id))) return SIMULATION
        if (writes && (await this.pipeline.gateOf(ctx, conversation)).refuses) return NEEDS_OWN_TURN
        const names = steps.map((step) => step.name)
        const reply = parsed.data.reply?.trim() ?? ""
        return this.ask(ctx, conversation, {
            stepKey: `${ctx.jobId}:sequence:${digestOf({ steps })}`,
            tool: names.join(" > "),
            reason: "playbook",
            draft: reply === "" ? this.catalog.get("gatewayTurns.approvedDone", {}, LOCALE) : reply,
            replay: { steps_json: JSON.stringify(steps) },
            tools: names,
            calls: steps.map((step) => ({ tool: step.name, argsJson: JSON.stringify(step.arguments) })),
        })
    }

    /** Opens the `gateway_call` approval of a held call or sequence with the turn's sources, and tells the agent it was asked. */
    private async ask(ctx: ToolContext, conversation: TurnConversation, seed: ApprovalSeed): Promise<JsonResult> {
        const wait =
            ctx.wakeId === undefined
                ? null
                : {
                      wakeId: ctx.wakeId,
                      calls: seed.calls,
                      scope: await this.scopeOf(ctx, conversation, seed.draft),
                  }
        const item = await this.approvals.ask(
            { workspaceId: ctx.workspaceId, actor: ENGINE_ACTOR, locale: LOCALE },
            { wait, spec: this.approvalOf(ctx, conversation, seed) },
        )
        return { status: "approval_requested", reason: seed.reason, work_item_id: item.id }
    }

    private approvalOf(ctx: ToolContext, conversation: TurnConversation, seed: ApprovalSeed): WorkSpec {
        return {
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
                    message_id: ctx.jobId,
                    agent_id: conversation.agent.id,
                    reason: seed.reason,
                    ...(ctx.wakeId === undefined ? {} : { in_run: "true" }),
                    sources: JSON.stringify(this.sourcesOf(ctx, seed.tools)),
                },
            },
        }
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
