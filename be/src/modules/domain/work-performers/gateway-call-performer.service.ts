import { Injectable, Optional } from "@nestjs/common"
import { AgentRunsService } from "@modules/domain/agent-runs"
import type {
    Performed,
    PerformedBy,
    Prepared,
    Proposal,
    WorkContext,
    WorkItem,
    WorkPerformer,
} from "@modules/domain/decisions"
import { McpGatewayService, type GatewayCaller, type GatewayJson } from "@modules/domain/mcp-gateway"
import { eachInOrder, parseJsonText } from "@modules/platform/primitives"
import { CustomerDeliveryService } from "./customer-delivery.service"
import { WorkPerformersError, WorkPerformersErrorCode } from "./errors/work-performers.error"
import type { GatewayStep, GatewaySteps } from "./gateway-steps.contracts"
import { gatewayStepsOf } from "./gateway-steps.policy"
import { gatewayApprovalWaitSchema } from "./gateway-call-performer.schema"

const isObject = (value: unknown): value is GatewayJson =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const textOf = (value: unknown): string => (typeof value === "string" ? value : "")

/** The one call a held call stored, or null when its tool or arguments are missing or no JSON object. */
const singleCallOf = (fields: Proposal["fields"]): GatewaySteps => {
    const tool = textOf(fields.tool)
    const read = parseJsonText(textOf(fields.args_json))
    return tool !== "" && read.ok && isObject(read.value) ? [{ name: tool, arguments: read.value }] : null
}

/** The calls an approval replays: the steps of a sequence when it holds one, else its one call. */
const callsOf = (fields: Proposal["fields"]): GatewaySteps =>
    fields.steps_json === undefined ? singleCallOf(fields) : gatewayStepsOf(fields.steps_json)

@Injectable()
/**
 * `gateway_call`: connector calls the MCP gateway or a playbook held for a person, one call (an argument over its constraint, an
 * amount over the limit, a tool in ask mode) or a sequence of steps the business knowledge names. Once approved it runs the exact
 * calls in order as approved by that person (audited under their name, each under its own replay key) and tells the customer the
 * approved outcome in their own conversation; the first call the connector refuses fails the item, so nothing is claimed and no
 * later step runs. A call held on the core road is not run here: it waits as a step of the run of its turn.
 */
export class GatewayCallPerformerService implements WorkPerformer {
    constructor(
        private readonly gateway: McpGatewayService,
        private readonly delivery: CustomerDeliveryService,
        @Optional() private readonly runs?: AgentRunsService,
    ) {}

    /** The proposal is preset by the turn that held the call. */
    prepare(_ctx: WorkContext, item: WorkItem): Promise<Prepared> {
        return Promise.resolve({ proposal: item.proposal })
    }

    /** Runs the calls as approved and answers the customer. */
    async perform(ctx: WorkContext, item: WorkItem, proposal: Proposal, by: PerformedBy): Promise<Performed> {
        const { fields } = proposal
        const calls = callsOf(fields)
        const conversationId = textOf(fields.conversation_id)
        if (calls === null || conversationId === "") {
            throw new WorkPerformersError({ code: WorkPerformersErrorCode.ApprovalInvalid, params: { item: item.id } })
        }
        // A model can name the field, but only the persisted wait owns these validated calls and their final reply.
        const links = (await this.runs?.linksFor(ctx.workspaceId, "approval", "workItemId", item.id)) ?? []
        const [wait] = links
        if (wait !== undefined) {
            const linked = gatewayApprovalWaitSchema.safeParse(wait.input)
            if (
                links.length !== 1 ||
                wait.kind !== "approval" ||
                wait.status !== "running" ||
                wait.waitItemId !== item.id ||
                wait.agentId !== textOf(fields.agent_id) ||
                !linked.success ||
                linked.data.workItemId !== item.id ||
                linked.data.scope.conversationId !== conversationId
            ) {
                throw new WorkPerformersError({
                    code: WorkPerformersErrorCode.ApprovalInvalid,
                    params: { item: item.id },
                })
            }
            return { summary: proposal.summary, evidence: "captured", lead_id: item.lead_id }
        }
        if (fields.in_run === "true")
            throw new WorkPerformersError({ code: WorkPerformersErrorCode.ApprovalInvalid, params: { item: item.id } })
        const caller: GatewayCaller = {
            workspaceId: ctx.workspaceId,
            agentId: textOf(fields.agent_id),
            conversationId,
            workItemId: item.id,
            approvedBy: by.name,
        }
        await eachInOrder(calls, (step, index) => this.run(caller, item, step, calls.length === 1 ? null : index))
        const reply = proposal.draft ?? ""
        // The approved answer leaves once, through the existing approved-reply path (stored with the decider's name, keyed by the item).
        if (reply !== "")
            await this.delivery.approvedInConversation(ctx.workspaceId, conversationId, reply, by.name, item.id)
        return { summary: proposal.summary, evidence: "captured", lead_id: item.lead_id, detail: reply || null }
    }

    /** Runs one approved call under its replay key (the item and the tool, plus the step number of a sequence). */
    private async run(caller: GatewayCaller, item: WorkItem, step: GatewayStep, index: number | null): Promise<void> {
        const opKey = index === null ? `${item.id}:${step.name}` : `${item.id}:${String(index)}:${step.name}`
        const result = await this.gateway.call({ ...caller, opKey }, step.name, step.arguments)
        if (!result.ok) {
            throw new WorkPerformersError({
                code: WorkPerformersErrorCode.ConnectorRefused,
                params: { tool: step.name, code: result.code },
            })
        }
    }
}
