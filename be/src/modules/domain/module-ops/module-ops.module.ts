import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ActionPerformerRegistry } from "./action-performer.port"
import { ApprovalGate } from "./approval-gate.port"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./module-ops.module-definition"
import { ActionPerformersService } from "./action-performers.service"
import { LoggingOfficeLogService } from "./logging-office-log.service"
import { OfficeLog } from "./office-log.port"
import { OutboundMail } from "./outbound-mail.port"
import { TextGenerator } from "./text-generator.port"
import { UnavailableApprovalGateService } from "./unavailable-approval-gate.service"
import { UnavailableOutboundMailService } from "./unavailable-outbound-mail.service"
import { UnavailableTextGeneratorService } from "./unavailable-text-generator.service"

@Module({})
/**
 * The shared base of the business modules (hiring, shifts, inventory): the performer registry and the four ports they work
 * through, bound to the degraded adapters until the owning capabilities (decisions, office, agents, mail) provide the real ones.
 */
export class ModuleOpsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: ActionPerformerRegistry, useClass: ActionPerformersService },
                { provide: ApprovalGate, useClass: UnavailableApprovalGateService },
                { provide: OfficeLog, useClass: LoggingOfficeLogService },
                { provide: OutboundMail, useClass: UnavailableOutboundMailService },
                { provide: TextGenerator, useClass: UnavailableTextGeneratorService },
            ],
            exports: [ActionPerformerRegistry, ApprovalGate, OfficeLog, OutboundMail, TextGenerator],
        }
    }
}
