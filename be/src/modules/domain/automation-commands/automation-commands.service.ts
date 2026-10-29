import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AutomationsError, AutomationsService } from "@modules/domain/automations"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { commandIdOf } from "./policies/command.policy"
import { AutomationCommandEntity } from "./persistence/entities"

@Injectable()
/**
 * The commands a manager's screen queues for the back end: the shop's own wording proposed with a model, a scheduled workflow run now.
 * The row proves the manager (a database function did, in the same transaction that queued the job); the answer or the code of the
 * reason it was refused is written back on the row, which the screen reads under RLS.
 */
export class AutomationCommandsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly automations: AutomationsService,
    ) {}

    /** Runs the command a job names and writes its outcome; a payload naming no waiting command is left alone. Other failures reach the job runner to retry. */
    async execute(payload: unknown): Promise<void> {
        const id = commandIdOf(payload)
        if (id === null) return
        const command = await this.entityManager.findOne(AutomationCommandEntity, {
            where: { id, status: "queued" },
        })
        if (command === null) return
        try {
            await this.settle(command.id, "done", await this.run(command), null)
        } catch (error) {
            if (!(error instanceof AutomationsError)) throw error
            await this.settle(command.id, "failed", null, error.code)
        }
    }

    private async run(row: AutomationCommandEntity): Promise<object> {
        if (row.kind === "run_now") {
            await this.automations.runNow(row.createdBy, row.workspaceId, row.templateKey)
            return {}
        }
        const proposal = await this.automations.proposeBody(row.createdBy, row.workspaceId, row.templateKey)
        return { body: proposal.body, generated: proposal.generated }
    }

    private async settle(
        id: string,
        status: "done" | "failed",
        result: object | null,
        fault: string | null,
    ): Promise<void> {
        await this.entityManager.update(
            AutomationCommandEntity,
            { id, status: "queued" },
            { status, result, faultCode: fault, finishedAt: this.clock.now() },
        )
    }
}
