import { outputInputSchema } from "./output-steps.schema"
import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { AgentRunHandlersService } from "@modules/domain/agent-runs"
import type { AgentStepHandler, StepAnswer, StepSpec, StepView } from "@modules/domain/agent-runs"
import { gatewayArgumentsSchema, McpGatewayService, outputStepOf } from "@modules/domain/mcp-gateway"
import type { GatewayCaller } from "@modules/domain/mcp-gateway"
import { parseJsonText } from "@modules/platform/primitives"
import { finalReplySpecOf, OUTPUT_STEP_KIND, outputResultOf, outputSpecOf } from "./output-steps.policy"
import type { OutputInput } from "./output-steps.schema"

/** Why the row cannot run: it holds no call. */
const INVALID_INPUT = "invalid_input"
/** The tool may have run and nothing says so: it is never called again, and a person looks. */
const OUTCOME_UNKNOWN = "tool_outcome_unknown"

/** The steps after an approved call: the next call while each one ran, then the final reply. A call inside a turn ends with the turn's own. */
const nextOf = (input: OutputInput, ran: boolean): ReadonlyArray<StepSpec> => {
    if (input.scope.workItemId === null) return []
    const [following, ...rest] = input.rest
    return ran && following !== undefined
        ? [outputSpecOf(following, rest, input.scope)]
        : [finalReplySpecOf(input.scope)]
}

@Injectable()
/**
 * The step of an output node. It runs one MCP call from its row, under the replay key of the row: a retry reads the sealed receipt and
 * never calls the tool twice, and a receipt left unsealed by a kill is an unknown outcome that goes to a person. A tool that refused is
 * no failed step: the run goes forward, because the customer is owed the truth. There is no undo; the final reply is what a failure owes.
 */
export class OutputStepHandlerService implements AgentStepHandler, OnModuleInit {
    /** The kind it runs. */
    readonly kind = OUTPUT_STEP_KIND

    constructor(
        private readonly handlers: AgentRunHandlersService,
        private readonly gateway: McpGatewayService,
    ) {}

    /** Registers with the run engine once the app has started. */
    onModuleInit(): void {
        this.handlers.add(this)
    }

    /** Runs the call of the row and leaves what it came to. */
    async run(step: StepView): Promise<StepAnswer> {
        const parsed = outputInputSchema.safeParse(step.input)
        if (!parsed.success) return { kind: "failed", code: INVALID_INPUT }
        const input = parsed.data
        const read = parseJsonText(input.argsJson)
        const args = gatewayArgumentsSchema.safeParse(read.ok ? read.value : null)
        if (!args.success) return { kind: "failed", code: INVALID_INPUT }
        const result = await this.gateway.call(this.callerOf(step, input), input.tool, args.data)
        if (!result.ok && result.code === "unknown_outcome") return { kind: "failed", code: OUTCOME_UNKNOWN }
        const output = outputStepOf(input.tool, result)
        return {
            kind: "done",
            result: outputResultOf(output, input.scope),
            next: nextOf(input, output.status === "ok"),
        }
    }

    private callerOf(step: StepView, input: OutputInput): GatewayCaller {
        const { conversationId, workItemId, approvedBy } = input.scope
        return {
            workspaceId: step.workspaceId,
            agentId: step.agentId,
            conversationId,
            workItemId,
            opKey: input.opKey,
            ...(approvedBy === null ? {} : { approvedBy }),
        }
    }
}
