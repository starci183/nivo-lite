import { Injectable } from "@nestjs/common"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectQueueTimeout } from "@modules/platform/queue"
import type { QueueTimeout } from "@modules/platform/queue"
import { InjectAgentGraphsOptions, InjectGraphFactReaders } from "./agent-graphs.decorators"
import { AgentGraphsLogEvent } from "./agent-graphs.log-events"
import type { FactRegistry, FactValues } from "./agent-graphs.contracts"
import type { AgentGraphsOptions } from "./agent-graphs.options"
import type { FactSubject, GraphFactReader } from "./agent-graphs.port"

/** The time a fact read may take when the options name none. */
const DEFAULT_READ_TIMEOUT_MS = 2000

@Injectable()
/**
 * The registry of facts and the one place they are read. Each module declares its facts beside its actions and reads them from
 * real records by subject id, in the agent view; this asks the reader that owns each fact, under a time limit, and a fact that
 * cannot be read is simply absent, so the branch falls to the `else` and never runs alone on a guess.
 */
export class GraphFactsService {
    constructor(
        @InjectGraphFactReaders() private readonly readers: ReadonlyArray<GraphFactReader>,
        @InjectAgentGraphsOptions() private readonly options: AgentGraphsOptions,
        @InjectQueueTimeout() private readonly timeout: QueueTimeout,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Every fact the readers declare, by key. */
    registry(): FactRegistry {
        return Object.fromEntries(this.readers.flatMap((reader) => reader.facts.map((spec) => [spec.key, spec])))
    }

    /** The facts of one subject, as far as they could be read; none that failed or ran out of time. */
    async read(workspaceId: string, subject: FactSubject, facts: ReadonlyArray<string>): Promise<FactValues> {
        const answers = await Promise.all(this.readers.map((reader) => this.ask(reader, workspaceId, subject, facts)))
        return answers.reduce<FactValues>((all, one) => ({ ...all, ...one }), {})
    }

    private async ask(
        reader: GraphFactReader,
        workspaceId: string,
        subject: FactSubject,
        facts: ReadonlyArray<string>,
    ): Promise<FactValues> {
        const own = facts.filter((fact) => reader.facts.some((spec) => spec.key === fact))
        if (own.length === 0) return {}
        const expiry = new AbortController()
        const deadline = new Promise<never>((_resolve, reject) => {
            expiry.signal.addEventListener("abort", () => {
                reject(new Error("fact read timed out"))
            })
        })
        const cancel = this.timeout.schedule(() => {
            expiry.abort()
        }, this.options.readTimeoutMs ?? DEFAULT_READ_TIMEOUT_MS)
        const read = Promise.resolve().then(() => reader.read(workspaceId, subject, own))
        const answered = await Promise.race([read, deadline]).catch((cause: unknown): FactValues => {
            this.logger.error(AgentGraphsLogEvent.FactUnreadable, cause, { workspaceId, subjectId: subject.id })
            return {}
        })
        cancel()
        return answered
    }
}
