import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./messages.module-definition"
import { MessagesService } from "./messages.service"

@Module({})
/** The team chat of a workspace over the primary Supabase PostgreSQL connection. */
export class MessagesModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return { ...base, providers: [...(base.providers ?? []), MessagesService], exports: [MessagesService] }
    }
}
