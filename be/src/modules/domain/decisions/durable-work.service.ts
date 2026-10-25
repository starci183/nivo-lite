import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { CommandPlannerService } from "./command-planner.service"
import type { SendCommandInput, WorkContext, WorkItem, WorkSpec } from "./decisions.contracts"
import { DecisionsError, DecisionsErrorCode } from "./errors/decisions.error"
import { WorkIntakeService } from "./work-intake.service"

@Injectable()
/** Accepts durable work in a producer's transaction; the ordinary work drain applies authority after commit. */
export class DurableWorkService {
    constructor(
        private readonly planner: CommandPlannerService,
        private readonly intake: WorkIntakeService,
    ) {}

    /** Inserts work with its execution options, without performing customer effects in the intake transaction. */
    async enqueueWork(ctx: WorkContext, spec: WorkSpec, manager: EntityManager): Promise<WorkItem> {
        const result = await this.intake.insert(ctx, { ...spec, queue: true }, manager)
        return result.item
    }

    /** Validates the typed command and commits its work item and command evidence together. */
    async enqueueCommand(ctx: WorkContext, input: SendCommandInput, manager: EntityManager): Promise<WorkItem> {
        const plan = await this.planner.plan(ctx, input, manager)
        if (!plan.ok) {
            throw new DecisionsError({
                code: DecisionsErrorCode.CommandRefused,
                params: { to: input.to, command: input.command, refused: plan.refused, detail: plan.detail },
            })
        }
        return this.enqueueWork(ctx, plan.spec, manager)
    }
}
