import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./chatbot-workbench.module-definition"
import { ChatbotWorkbenchService } from "./chatbot-workbench.service"

@Module({})
/** The read projection of the Chatbot customer workbench. */
export class ChatbotWorkbenchModule extends ConfigurableModuleClass {
    /** Registers the workbench readers in their owning feature. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ChatbotWorkbenchService],
            exports: [ChatbotWorkbenchService],
        }
    }
}
