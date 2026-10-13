import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ActionPerformerRegistry } from "./action-performer.port"
import { ApprovalGate } from "./approval-gate.port"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./module-ops.module-definition"
import { LoggingOfficeLogService } from "./logging-office-log.service"
import { OfficeLog } from "./office-log.port"
import { OutboundMail } from "./outbound-mail.port"
import { ModuleTextGenerator } from "./text-generator.port"

@Module({})
/**
 * The shared base of the business modules (hiring, shifts, inventory): the performer registry and the four ports they work
 * through. The app root names the class behind each port: the decisions capability owns the registry and the gate, the
 * email-messages capability the mailer and the ai-generations capability the text generator.
 */
export class ModuleOpsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: ActionPerformerRegistry, useClass: options.ports.performers },
                { provide: ApprovalGate, useClass: options.ports.approvalGate },
                { provide: OfficeLog, useClass: LoggingOfficeLogService },
                { provide: OutboundMail, useClass: options.ports.outboundMail },
                { provide: ModuleTextGenerator, useClass: options.ports.textGenerator },
            ],
            exports: [ActionPerformerRegistry, ApprovalGate, OfficeLog, OutboundMail, ModuleTextGenerator],
        }
    }
}
