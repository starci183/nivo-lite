import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AuthorityService } from "./authority.service"
import { CommandBusService } from "./command-bus.service"
import { CommandPlannerService } from "./command-planner.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./decisions.module-definition"
import { DecisionsService } from "./decisions.service"
import { EvidenceService } from "./evidence.service"
import { ModuleCatalogService } from "./module-catalog.service"
import { OfficeLinesService } from "./office-lines.service"
import { ResponsibilitiesService } from "./responsibilities.service"
import { WorkEngineService } from "./work-engine.service"
import { WORK_PERFORMER_REGISTRY } from "./work-performer.port"
import { WorkPerformersService } from "./work-performers.service"

@Module({})
/**
 * Work items, the policy gate, the authority, the command bus and the logs. The app root provides the ports it reads through:
 * the agent directory, the inbound event status, the decision events, the payment receipts, the lead generation flow and
 * the outbound access gate, plus the events and workspace-members capabilities.
 */
export class DecisionsModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: WORK_PERFORMER_REGISTRY, useExisting: WorkPerformersService },
                AuthorityService,
                CommandBusService,
                CommandPlannerService,
                DecisionsService,
                EvidenceService,
                ModuleCatalogService,
                OfficeLinesService,
                ResponsibilitiesService,
                WorkEngineService,
                WorkPerformersService,
            ],
            exports: [
                WORK_PERFORMER_REGISTRY,
                AuthorityService,
                CommandBusService,
                DecisionsService,
                EvidenceService,
                ModuleCatalogService,
                OfficeLinesService,
                ResponsibilitiesService,
                WorkEngineService,
            ],
        }
    }
}
