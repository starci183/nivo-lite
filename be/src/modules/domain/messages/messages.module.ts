import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./messages.module-definition"
import { OfficeLinesService } from "./office-lines.service"

@Module({})
/** The Office thread. The app root provides the `AGENT_DIRECTORY` port it reads through. */
export class MessagesModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return { ...base, providers: [...(base.providers ?? []), OfficeLinesService], exports: [OfficeLinesService] }
    }
}
