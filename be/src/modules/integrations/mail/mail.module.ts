import { MailModule as PackageMailModule } from "@starci/mail"
import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { MAILER_FACTORY, MAIL_SETTINGS, MAIL_RELAY, packageMailerFactory } from "./mail.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./mail.module-definition"
import { MailRelayService } from "./mail-relay.service"

@Module({})
/**
 * Composes `@starci/mail` with the app's typed settings: the platform sender (the `Mailer` port), the settings of the app's own
 * mail, and the sender of a workspace's own SMTP account.
 */
export class MailModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const { isGlobal, ...settings } = options
        const base = super.register(options)
        const mail = PackageMailModule.register({ ...settings, isGlobal: false })
        return {
            ...base,
            imports: [...(base.imports ?? []), mail],
            providers: [
                ...(base.providers ?? []),
                { provide: MAIL_SETTINGS, useValue: settings },
                { provide: MAILER_FACTORY, useValue: packageMailerFactory },
                { provide: MAIL_RELAY, useClass: MailRelayService },
            ],
            exports: [...(base.exports ?? []), mail, MAIL_SETTINGS, MAIL_RELAY],
            global: isGlobal === true,
        }
    }
}
