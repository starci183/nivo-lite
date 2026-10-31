import { Injectable } from "@nestjs/common"
import { AgentDrainService } from "@modules/domain/agent-work"
import { isAgentTurnDrainPayload } from "@modules/queues/agent-turn"
import { AgentSchedulesError, AgentSchedulesErrorCode } from "./errors/agent-schedules.error"

@Injectable()
/** The door of the drain job into the work store: the job names one scope of one agent, and one turn of it is taken and run. */
export class AgentDrainJobService {
    constructor(private readonly drain: AgentDrainService) {}

    /** Drains the scope a drain job names; a payload that names no agent and scope ends the job with no retry. */
    async run(job: object): Promise<void> {
        if (!isAgentTurnDrainPayload(job)) {
            throw new AgentSchedulesError({
                code: AgentSchedulesErrorCode.DrainPayloadInvalid,
                params: { unrecoverable: 1 },
            })
        }
        await this.drain.drain(job)
    }
}
