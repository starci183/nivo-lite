import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AUTOMATION_GATE, AUTOMATION_OFFICE, AUTOMATION_RECORDS } from "@modules/domain/automations"
import { FlowEngineModule, FlowEngineService } from "@modules/domain/flow-engine"
import { FLOW_GATE } from "@modules/domain/flows"
import { AutomationGateService } from "./automation-gate.service"
import { AutomationOfficeService } from "./automation-office.service"
import { AutomationRecordsService } from "./automation-records.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./automation-ports.module-definition"

@Module({})
/**
 * Binds the ports of the automations to the capabilities that serve them: the authority gate (the work engine), Office (team chat,
 * evidence log, follow-up tasks), the lead and contract records, and the flow engine, which it composes to bind the flows port.
 */
export class AutomationPortsModule extends ConfigurableModuleClass {
    /** Registers the ports once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [...(base.imports ?? []), FlowEngineModule.register({})],
            providers: [
                ...(base.providers ?? []),
                { provide: AUTOMATION_GATE, useClass: AutomationGateService },
                { provide: AUTOMATION_OFFICE, useClass: AutomationOfficeService },
                { provide: AUTOMATION_RECORDS, useClass: AutomationRecordsService },
                { provide: FLOW_GATE, useExisting: FlowEngineService },
            ],
            exports: [AUTOMATION_GATE, AUTOMATION_OFFICE, AUTOMATION_RECORDS, FLOW_GATE],
        }
    }
}
