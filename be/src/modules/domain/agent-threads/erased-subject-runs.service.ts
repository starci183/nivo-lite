import { Injectable, Optional } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentRunsService, type RunSubject } from "@modules/domain/agent-runs"
import { DeliveredWakesService } from "@modules/domain/provider-triggers"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { AgentThreadsLogEvent } from "./agent-threads.log-events"

/** The one typed terminal reason of a run ended because its subject was erased, and of the wakes held behind it. */
export const SUBJECT_ERASED = "subject_erased"

@Injectable()
/**
 * THE END OF THE RUNS OF AN ERASED SUBJECT (coordinator ruling R37 on owner ruling R31): when a subject is erased (a contact deleted, and
 * with it every route it holds), no event of it will come again (the person writing again is a NEW contact on a NEW route), so a run
 * parked on it would sit until its own expiry and keep the one-run-per-subject slot. In the caller's transaction, every thread run of any
 * agent parked on one of the subjects is ended with the typed reason `subject_erased` (its wait mark and deadline cleared), the wakes held
 * behind it (`waiting:<run>`) are dropped with the same reason through the delivery piece's re-offer door (`DeliveredWakesService`), and
 * one run event is recorded per run (the run row's terminal error and one log line). No stop card is raised and nobody is told. Generic: it knows subjects (kind + id), never what a contact or a chat is.
 */
export class ErasedSubjectRunsService {
    constructor(
        private readonly runs: AgentRunsService,
        private readonly wakes: DeliveredWakesService,
        @Optional() @InjectLogger() private readonly logger?: Logger,
    ) {}

    /** Ends the runs parked on the subjects and drops the wakes held behind them, in `tx`; answers how many runs it ended. */
    async ended(tx: EntityManager, workspaceId: string, subjects: ReadonlyArray<RunSubject>): Promise<number> {
        if (subjects.length === 0) return 0
        const ended = await this.runs.endParkedOfSubjects(tx, workspaceId, subjects, SUBJECT_ERASED)
        await eachInOrder(ended, async (run) => {
            const dropped = await this.wakes.dropWaiting(tx, workspaceId, run.id, SUBJECT_ERASED)
            this.logger?.info(AgentThreadsLogEvent.SubjectErasedRunEnded, { runId: run.id, agentId: run.agentId, dropped })
        })
        return ended.length
    }
}
