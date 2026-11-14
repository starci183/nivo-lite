import { Module, type DynamicModule, type OnModuleInit } from "@nestjs/common"
import { triggerDeclarations } from "@modules/domain/provider-triggers"
import { INBOX, InboxService } from "@modules/platform/inbox"
import { AgentEventWakesService } from "./agent-event-wakes.service"
import { AgentDrainJobService } from "./agent-drain-job.service"
import { AgentProbesService } from "./agent-probes.service"
import { AgentScheduleFireService } from "./agent-schedule-fire.service"
import { AccountingCloseProbeService } from "./probes/accounting-close-probe.service"
import { NewDocumentsProbeService } from "./probes/new-documents-probe.service"
import { TasksDueProbeService } from "./probes/tasks-due-probe.service"
import { AgentTriggerSyncService } from "./agent-trigger-sync.service"
import { AgentWorkSweepService } from "./agent-work-sweep.service"
import { ClockTickDeliveryService } from "./clock-tick-delivery.service"
import { CLOCK_TICK_TRIGGER, TIMER_DUE_TRIGGER } from "./engine-time.triggers"
import { WORKFLOW_CALL_TRIGGER } from "./workflow-call.trigger"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./agent-schedules.module-definition"

@Module({})
/**
 * The clock of the agents: a keyed scheduler per trigger row, the fire that turns a slot into a wake, the probes that keep a quiet clock
 * free of model calls, and the minute sweep that repairs what Redis or a lost job left behind. It reads and writes the work store through
 * its services and never its tables.
 */
export class AgentSchedulesModule extends ConfigurableModuleClass implements OnModuleInit {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const reactive =
            options.reactive === true
                ? [
                      AgentEventWakesService, { provide: INBOX, useClass: InboxService }]
                : []
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                TasksDueProbeService,
                NewDocumentsProbeService,
                AccountingCloseProbeService,
                AgentDrainJobService,
                AgentProbesService,
                AgentTriggerSyncService,
                AgentScheduleFireService,
                AgentWorkSweepService,
                ClockTickDeliveryService,
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

    /** Registers the clock's, the timer's and the workflow call's triggers once (the slots, the due timers and every call deliver through them). */
    onModuleInit(): void {
        triggerDeclarations.register(CLOCK_TICK_TRIGGER, TIMER_DUE_TRIGGER, WORKFLOW_CALL_TRIGGER)
    }
}
