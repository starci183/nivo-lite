import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { BrainChangeMessagesService } from "@modules/domain/brain"
import { AGENT_THREADS_OPTIONS } from "./agent-threads.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./agent-threads.module-definition"
import { ApprovalItemsService } from "./stops/approval-items.service"
import { RunStopRecordsService } from "./stops/run-stop-records.service"
import { RUN_STOP_STORE } from "./stops/run-stop-store.port"
import { TypeormRunStopStore } from "./stops/run-stop-store.typeorm"
import { RunStopsService } from "./stops/run-stops.service"
import { StopAnswersService } from "./stops/stop-answers.service"
import { StopCardsService } from "./stops/stop-cards.service"
import { StopDoorService } from "./stops/stop-door.service"
import { StopHandBackService } from "./stops/stop-hand-back.service"
import { StopLearningDoorService } from "./stops/stop-learning-door.service"
import { STOP_LEARNING_CARDS } from "./stops/stop-learning.contracts"
import { StopLearningService } from "./stops/stop-learning.service"
import { ThreadDeadlineQueueModule } from "@modules/queues/thread-deadline"
import { ThreadApprovalsService } from "./thread-approvals.service"
import { ThreadDeadlinesService } from "./thread-deadlines.service"
import { ThreadGraphsService } from "./thread-graphs.service"
import { ThreadProjectionService } from "./thread-projection.service"
import { ThreadResumeRequestsService } from "./thread-resume-requests.service"
import { ThreadRunsService } from "./thread-runs.service"
import { ThreadStepService } from "./thread-step.service"
import { ThreadSweepService } from "./thread-sweep.service"
import { UntilRoundTimersService } from "./until-round-timers.service"
import { UntilRoundWakesService } from "./until-round-wakes.service"
import { ThreadWaitsService } from "./thread-waits.service"
import { ThreadHandBacksService } from "./thread-hand-backs.service"
import { ErasedSubjectRunsService } from "./erased-subject-runs.service"
import { ErasedContactRunsAdapter } from "./erased-contact-runs.adapter"
import { CONTACT_RUNS } from "@modules/domain/contacts/contact-runs.port"

@Module({})
/**
 * The engine's runs on LangGraph threads: the stops of a run, the projection of a thread into the run and step rows, the node
 * function of a step and the thread runs that drive them under the work core's lease. It registers with the graph flows when the
 * app starts, so the flows hold it in no constructor; with an empty flag it takes no run and the old engine runs everything.
 * It needs the graph flows, the run engine, the work core, the node host, the entity engine, the team chat and the LangGraph
 * integration of the app, all registered globally; without the LangGraph integration it stays out of the flows. The deadlines of the
 * stops are delayed jobs of its own queue (`thread_deadline`, fired by the `fire-thread-deadline` job feature), and its sweep rides the
 * minute sweep of the agent work.
 */
export class AgentThreadsModule extends ConfigurableModuleClass {
    /** Registers the capability once per app that runs wakes. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        // The people's doors to a stop need the app's members, access and run cancel: only an app that serves people registers them.
        const doors = options.doors === true
            ? [StopDoorService, StopAnswersService, StopLearningDoorService, StopLearningService,
               { provide: STOP_LEARNING_CARDS, useExisting: BrainChangeMessagesService }]
            : []
        return {
            ...base,
            imports: [...(base.imports ?? []), ThreadDeadlineQueueModule],
            providers: [
                ...(base.providers ?? []),
                // The stops of the runs (public.run_stops): the one store every stop read and write goes through.
                TypeormRunStopStore,
                { provide: RUN_STOP_STORE, useExisting: TypeormRunStopStore },
                RunStopRecordsService,
                ApprovalItemsService,
                StopCardsService,
                RunStopsService,
                ThreadApprovalsService,
                ...doors,
                ThreadProjectionService,
                UntilRoundTimersService,
                ThreadStepService,
                ThreadGraphsService,
                ThreadRunsService,
                ThreadResumeRequestsService,
                // A hand-back of a route ends the take-overs left on it (R51 item 3), through the resume door above.
                StopHandBackService,
                UntilRoundWakesService,
                ThreadWaitsService,
                ThreadHandBacksService,
                ErasedSubjectRunsService,
                // The runs of a contact being deleted, as the contacts see them (R37): ended in the deletion's own transaction.
                ErasedContactRunsAdapter,
                { provide: CONTACT_RUNS, useExisting: ErasedContactRunsAdapter },
                ThreadDeadlinesService,
                ThreadSweepService,
            ],
            exports: [
                AGENT_THREADS_OPTIONS,
                RUN_STOP_STORE,
                RunStopRecordsService,
                RunStopsService,
                ThreadApprovalsService,
                ...doors,
                ThreadProjectionService,
                UntilRoundTimersService,
                ThreadStepService,
                ThreadGraphsService,
                ThreadRunsService,
                ThreadResumeRequestsService,
                StopHandBackService,
                UntilRoundWakesService,
                ThreadWaitsService,
                ThreadHandBacksService,
                ErasedSubjectRunsService,
                CONTACT_RUNS,
                ThreadDeadlinesService,
                ThreadSweepService,
            ],
        }
    }

    /**
     * The stops without the engine (the mcp app): the store and its records, and the answer road that runs on stores alone (the stop
     * door, the approvals' verdict door, the resume request that records a decision as the run's resume wake for the api's drain).
     * Nothing here drives a thread, reads a checkpoint, posts a card or runs a node: no LangGraph, no node host, no tools. A method of
     * its own, so the static emitter reads each shape without deciding an option.
     */
    static registerRecords(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const answers = [
            ApprovalItemsService,
            StopCardsService,
            RunStopsService,
            ThreadApprovalsService,
            ThreadResumeRequestsService,
            StopDoorService,
            StopHandBackService,
        ]
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                TypeormRunStopStore,
                { provide: RUN_STOP_STORE, useExisting: TypeormRunStopStore },
                RunStopRecordsService,
                ...answers,
            ],
            exports: [RUN_STOP_STORE, RunStopRecordsService, ...answers],
        }
    }
}
