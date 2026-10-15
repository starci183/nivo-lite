import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import {
    AUTOMATION_GATE,
    AUTOMATION_OFFICE,
    AUTOMATION_OWNER_CHAT,
    AUTOMATION_RECORDS,
    AUTOMATION_TEXT,
} from "@modules/domain/automations"
import { FlowEngineModule, FlowEngineService } from "@modules/domain/flow-engine"
import { FLOW_GATE } from "@modules/domain/flows"
import { AutomationGateService } from "./automation-gate.service"
import { AutomationOfficeService } from "./automation-office.service"
import { AutomationOwnerChatService } from "./automation-owner-chat.service"
import { AutomationRecordsService } from "./automation-records.service"
import { AutomationTextService } from "./automation-text.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./automation-ports.module-definition"

@Module({})
/**
 * Binds the ports of the automations to the capabilities that serve them: the authority gate (the work engine), Office (team chat,
 * evidence log, follow-up tasks), the lead and contract records, generated text, owner chat, and the flow engine.
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
                { provide: AUTOMATION_TEXT, useClass: AutomationTextService },
                { provide: AUTOMATION_OWNER_CHAT, useClass: AutomationOwnerChatService },
                { provide: FLOW_GATE, useExisting: FlowEngineService },
            ],
            exports: [
                AUTOMATION_GATE,
                AUTOMATION_OFFICE,
                AUTOMATION_RECORDS,
                AUTOMATION_TEXT,
                AUTOMATION_OWNER_CHAT,
                FLOW_GATE,
            ],
        }
    }
}
