import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AuthorityChatService } from "./authority-chat.service"
import { FlowEngineService } from "./flow-engine.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./flow-engine.module-definition"
import { OwnerChatService } from "./owner-chat.service"

@Module({})
/**
 * The operating-flow engine: runs the commands of the flows doors through the capabilities that own them, and the owner's
 * plain-words authority and typed decisions in Office. It reads the decisions, staff, chat reply, leads,
 * authority actions and deepseek capabilities the app root registers globally; the app root binds the flows port to its service.
 */
export class FlowEngineModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), AuthorityChatService, OwnerChatService, FlowEngineService],
            exports: [FlowEngineService],
        }
    }
}
