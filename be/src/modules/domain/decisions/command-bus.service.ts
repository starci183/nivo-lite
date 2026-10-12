import { Injectable } from "@nestjs/common"
import { CommandPlannerService } from "./command-planner.service"
import type { CommandResult, SendCommandInput, WorkContext, WorkItem } from "./decisions.contracts"
import { DecisionsError, DecisionsErrorCode } from "./errors/decisions.error"
import { WorkEngineService } from "./work-engine.service"

@Injectable()
/**
 * The agent command bus. Agents coordinate only by typed commands: the receiver's contract, the depth and cycle limits are
 * checked by the planner, then the command becomes the receiver's own work item through the engine, so the receiver's gate
 * (its authority rule, limit, operating mode and approval) decides. A sender never lends its authority, and a repeat of the
 * same dedupe key returns the first item and creates nothing.
 */
export class CommandBusService {
    constructor(
        private readonly planner: CommandPlannerService,
        private readonly engine: WorkEngineService,
    ) {}

    /**
     * Sends one command to a module. Validates the contract, the depth and the cycle rule, creates the receiver's work item
     * through the engine and mirrors it in the Office; answers the item, or the refusal. A repeated dedupe key answers the
     * existing item (`created: false`) and posts nothing.
     */
    async sendCommand(ctx: WorkContext, input: SendCommandInput): Promise<CommandResult> {
        const plan = await this.planner.plan(ctx, input)
        if (!plan.ok) return plan
        const item = await this.engine.runWork(ctx, plan.spec)
        return { ok: true, item, created: plan.inserted(), chainId: item.chain_id, depth: item.depth }
    }

    /** `sendCommand` for callers that cannot continue without the work item: a refusal is a programming error and throws. */
    async sendCommandItem(ctx: WorkContext, input: SendCommandInput): Promise<WorkItem> {
        const result = await this.sendCommand(ctx, input)
        if (result.ok) return result.item
        throw new DecisionsError({
            code: DecisionsErrorCode.CommandRefused,
            params: { to: input.to, command: input.command, refused: result.refused, detail: result.detail },
        })
    }
}
