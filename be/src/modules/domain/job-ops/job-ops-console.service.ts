import { Injectable } from "@nestjs/common"
import type { JobOpsConsoleOutput } from "./job-ops.contracts"
import { JobOpsService } from "./job-ops.service"

const parseJobNumber = (value: string | undefined, fallback: number): number => {
    if (value === undefined) return fallback
    return value.trim() === value && /^[0-9]+$/u.test(value) ? Number(value) : Number.NaN
}

@Injectable()
/** The operator arguments and terminal output of the jobs capability. */
export class JobOpsConsoleService {
    constructor(private readonly jobs: JobOpsService) {}

    /** Prints the current database statistics as pretty JSON. */
    async stats(_passedParams: Array<string>, output: JobOpsConsoleOutput): Promise<void> {
        output.write(`${JSON.stringify(await this.jobs.stats(), null, 2)}\n`)
    }

    /** Prints one failed job per line in the operator script's column order. */
    async failed([limit]: Array<string>, output: JobOpsConsoleOutput): Promise<void> {
        const rows = await this.jobs.failed(parseJobNumber(limit, 20))
        for (const row of rows) {
            const line = [row.id, row.name, row.attempts, row.finished_at, row.last_error]
                .map((value) => value ?? "")
                .join(" | ")
            output.write(`${line}\n`)
        }
    }

    /** Prints one open job per line in the operator script's column order. */
    async open([limit]: Array<string>, output: JobOpsConsoleOutput): Promise<void> {
        const rows = await this.jobs.open(parseJobNumber(limit, 20))
        for (const row of rows) {
            const line = [row.id, row.name, row.state, row.attempts, row.created_at, row.last_error]
                .map((value) => value ?? "")
                .join(" | ")
            output.write(`${line}\n`)
        }
    }

    /** Prints the new lossless message id or reports that the job is not failed. */
    async requeue([outboxId = ""]: Array<string>, output: JobOpsConsoleOutput): Promise<void> {
        const messageId = await this.jobs.requeue(outboxId)
        output.write(messageId === null ? "not a failed job\n" : `requeued as message ${messageId}\n`)
    }

    /** Prints the number requeued against the number of eligible failed jobs. */
    async requeueFailed([hours]: Array<string>, output: JobOpsConsoleOutput): Promise<void> {
        const result = await this.jobs.requeueFailed(parseJobNumber(hours, 24))
        output.write(`requeued ${result.requeued} of ${result.failed}\n`)
    }

    /** Prints the failure count and oldest queued age separated by one space. */
    async watchdog(_passedParams: Array<string>, output: JobOpsConsoleOutput): Promise<void> {
        const result = await this.jobs.watchdog()
        output.write(`${result.failed24h} ${result.oldestQueuedAgeSeconds}\n`)
    }
}
