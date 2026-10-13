import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AUTOMATION_GATE, AUTOMATION_OFFICE, AUTOMATION_RECORDS } from "@modules/domain/automations"
import { FLOW_GATE } from "@modules/domain/flows"
import { AutomationPortsService } from "./automation-ports.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./automation-ports.module-definition"

@Module({})
/** Binds the ports of the automations that no landed capability serves yet (the mailer is bound by the work performers) to a service that refuses with the name of the port. */
export class AutomationPortsModule extends ConfigurableModuleClass {
    /** Registers the pending ports once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                AutomationPortsService,
                { provide: AUTOMATION_GATE, useExisting: AutomationPortsService },
                { provide: AUTOMATION_OFFICE, useExisting: AutomationPortsService },
                { provide: AUTOMATION_RECORDS, useExisting: AutomationPortsService },
                { provide: FLOW_GATE, useExisting: AutomationPortsService },
            ],
            exports: [AUTOMATION_GATE, AUTOMATION_OFFICE, AUTOMATION_RECORDS, FLOW_GATE],
        }
    }
}
