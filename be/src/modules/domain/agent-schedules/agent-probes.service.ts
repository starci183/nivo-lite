import { Injectable } from "@nestjs/common"
import type { AgentWakeContext } from "@modules/domain/agent-work"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectQueueTimeout } from "@modules/platform/queue"
import type { QueueTimeout } from "@modules/platform/queue"
import { PROBE_BUDGET_MS } from "./agent-schedules.policy"
import { AgentSchedulesLogEvent } from "./agent-schedules.log-events"
import { InvoicesDueProbeService } from "./probes/invoices-due-probe.service"
import { MoneyInProbeService } from "./probes/money-in-probe.service"
import { NewDocumentsProbeService } from "./probes/new-documents-probe.service"
import { TasksDueProbeService } from "./probes/tasks-due-probe.service"
import type { AgentProbe, ProbeAgent, ProbeAnswer, ProbeDecision } from "./agent-schedules.contracts"

/** What a probe run ended in when it did not answer: its time ran out. */
const TIMED_OUT = "timed_out"

@Injectable()
/**
 * The code-first gate: a `schedule` or `event` wake reaches the model only when its probe finds work. A wake that carries a task needs no
 * probe, a clock or event wake that names none is skipped (no probe, no model), a wake of a person always runs, and a probe that fails or takes over two seconds skips the wake with no model call.
 */
export class AgentProbesService {
    private readonly probes: ReadonlyMap<string, AgentProbe>

    constructor(
        @InjectQueueTimeout() private readonly timeout: QueueTimeout,
        @InjectLogger() private readonly logger: Logger,
        tasksDue: TasksDueProbeService,
        invoicesDue: InvoicesDueProbeService,
        newDocuments: NewDocumentsProbeService,
        moneyIn: MoneyInProbeService,
    ) {
        const known: ReadonlyArray<AgentProbe> = [tasksDue, invoicesDue, newDocuments, moneyIn]
        this.probes = new Map(known.map((probe) => [probe.key, probe]))
    }

    /** Decides whether the wake runs the model: with the brief of what the probe found, or skipped with the reason. */
    async decide(agent: ProbeAgent, context: AgentWakeContext): Promise<ProbeDecision> {
        if (context.taskId !== undefined) return { kind: "run", brief: null, subjectIds: [context.taskId] }
        if (context.probeKey === undefined) {
            // A clock or an event with no probe has nothing to look at: no probe, no model. Any other wake (a person's) always runs.
            const fromClock = context.triggerId !== undefined || context.eventName !== undefined
            return fromClock ? { kind: "skip", reason: "no_probe" } : { kind: "run", brief: null, subjectIds: [] }
        }
        const probe = this.probes.get(context.probeKey)
        const answer = probe === undefined ? null : await this.answerOf(probe, agent)
        if (answer === null) {
            this.logger.warn(AgentSchedulesLogEvent.ProbeSkipped, {
                agentId: agent.agentId,
                probeKey: context.probeKey,
            })
            return { kind: "skip", reason: "probe_failed" }
        }
        if (!answer.work) return { kind: "skip", reason: "no_work" }
        return { kind: "run", brief: answer.brief, subjectIds: answer.subjectIds }
    }

    /** The answer of a probe, or null when it threw or did not answer within its budget. */
    private answerOf(probe: AgentProbe, agent: ProbeAgent): Promise<ProbeAnswer | null> {
        const cancels: Array<() => void> = []
        const deadline = new Promise<typeof TIMED_OUT>((resolve) => {
            cancels.push(this.timeout.schedule(() => resolve(TIMED_OUT), PROBE_BUDGET_MS))
        })
        return Promise.race([probe.check(agent), deadline])
            .then((answer) => (answer === TIMED_OUT ? null : answer))
            .catch((cause: unknown) => {
                this.logger.error(AgentSchedulesLogEvent.ProbeFailed, cause, {
                    agentId: agent.agentId,
                    probeKey: probe.key,
                })
                return null
            })
            .finally(() => {
                for (const cancel of cancels) cancel()
            })
    }
}
