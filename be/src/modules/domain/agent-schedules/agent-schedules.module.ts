import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { BackgroundWorkHandlerService } from "./background-work-handler.service"
import { INBOX, InboxService } from "@modules/platform/inbox"
import { WakeAgentExecutorService } from "./wake-agent-executor.service"
import { AgentEventWakesService } from "./agent-event-wakes.service"
import { AgentDrainJobService } from "./agent-drain-job.service"
import { AgentProbesService } from "./agent-probes.service"
import { AgentScheduleFireService } from "./agent-schedule-fire.service"
import { InvoicesDueProbeService } from "./probes/invoices-due-probe.service"
import { MoneyInProbeService } from "./probes/money-in-probe.service"
import { NewDocumentsProbeService } from "./probes/new-documents-probe.service"
import { TasksDueProbeService } from "./probes/tasks-due-probe.service"
import { AgentTriggerSyncService } from "./agent-trigger-sync.service"
import { AgentWorkSweepService } from "./agent-work-sweep.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./agent-schedules.module-definition"

@Module({})
/**
 * The clock of the agents: a keyed scheduler per trigger row, the fire that turns a slot into a wake, the probes that keep a quiet clock
 * free of model calls, and the minute sweep that repairs what Redis or a lost job left behind. It reads and writes the work store through
 * its services and never its tables.
 */
export class AgentSchedulesModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const reactive =
            options.reactive === true
                ? [
                      BackgroundWorkHandlerService,
                      AgentEventWakesService,
                      WakeAgentExecutorService,
                      { provide: INBOX, useClass: InboxService },
                  ]
                : []
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                TasksDueProbeService,
                InvoicesDueProbeService,
                NewDocumentsProbeService,
                MoneyInProbeService,
                AgentDrainJobService,
                AgentProbesService,
                AgentTriggerSyncService,
                AgentScheduleFireService,
                AgentWorkSweepService,
                ...reactive,
            ],
            exports: [
                ...(options.reactive === true ? [AgentEventWakesService] : []),
                AgentDrainJobService,
                AgentProbesService,
                AgentTriggerSyncService,
                AgentScheduleFireService,
                AgentWorkSweepService,
            ],
        }
    }
}
