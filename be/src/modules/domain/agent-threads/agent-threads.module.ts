import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./agent-threads.module-definition"
import { RunStopRecordsService } from "./stops/run-stop-records.service"
import { RunStopsService } from "./stops/run-stops.service"
import { StopCardsService } from "./stops/stop-cards.service"
import { ThreadDeadlineQueueModule } from "@modules/queues/thread-deadline"
import { ThreadDeadlinesService } from "./thread-deadlines.service"
import { ThreadGraphsService } from "./thread-graphs.service"
import { ThreadProjectionService } from "./thread-projection.service"
import { ThreadRunsService } from "./thread-runs.service"
import { ThreadStepService } from "./thread-step.service"
import { ThreadSweepService } from "./thread-sweep.service"

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
        return {
            ...base,
            imports: [...(base.imports ?? []), ThreadDeadlineQueueModule],
            providers: [
                ...(base.providers ?? []),
                RunStopRecordsService,
                StopCardsService,
                RunStopsService,
                ThreadProjectionService,
                ThreadStepService,
                ThreadGraphsService,
                ThreadRunsService,
                ThreadDeadlinesService,
                ThreadSweepService,
            ],
            exports: [
                RunStopsService,
                ThreadProjectionService,
                ThreadStepService,
                ThreadGraphsService,
                ThreadRunsService,
                ThreadDeadlinesService,
                ThreadSweepService,
            ],
        }
    }
}
