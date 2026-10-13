import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { MailClient } from "./mail.client"
import { MAIL } from "./mail.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./mail.module-definition"

@Module({})
/** Provides the mail client. */
export class MailModule extends ConfigurableModuleClass {
    /** Registers the integration once per app that sends mail. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: MAIL, useClass: MailClient }],
            exports: [MAIL],
        }
    }
}
