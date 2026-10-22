import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./member-grants.module-definition"
import { MemberGrantsService } from "./member-grants.service"

@Module({})
/** What each member may approve, per action and up to which amount, over the primary Supabase PostgreSQL connection. */
export class MemberGrantsModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), MemberGrantsService],
            exports: [MemberGrantsService],
        }
    }
}
