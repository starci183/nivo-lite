import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { CONNECTION_COMMANDS_QUEUE } from "@modules/queues/connection-commands"
import { RunCommandStep } from "../../steps/run-command.step"

@Injectable()
/** The processor of the connection-commands job: the runner claims and settles it; `process` delegates the fenced claim to the one step. */
export class ConnectionCommandsProcessor extends FencedProcessor {
    readonly queue = CONNECTION_COMMANDS_QUEUE

    constructor(private readonly runCommand: RunCommandStep) {
        super()
    }

    /** Runs the command; a stale token throws the fenced-out error from the guarded write before the effect and nothing else happens. */
    async process(job: ClaimedJob): Promise<void> {
        await this.runCommand.run(job)
    }
}
