import { MAILER } from "@starci/mail"
import { Module, type DynamicModule } from "@nestjs/common"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { MAILER_FACTORY, MAIL_OUTBOX, MAIL_RELAY, MAIL_SETTINGS, packageMailerFactory } from "./mail.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./mail.module-definition"
import type { MailOptions } from "./mail.options"
import { MailOutboxService } from "./mail-outbox.service"
import { MailRelayService } from "./mail-relay.service"
import { SuppressingMailerService } from "./suppressing-mailer.service"

@Module({})
/**
 * Composes `@starci/mail` with the app's typed settings: the platform sender (the `Mailer` port, behind the suppress list), the settings
 * of the app's own mail, the development outbox and the sender of a workspace's own SMTP account.
 */
export class MailModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const { isGlobal, ...settings } = options
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: MAIL_SETTINGS, useValue: settings },
                { provide: MAILER_FACTORY, useValue: packageMailerFactory },
                { provide: MAIL_OUTBOX, useClass: MailOutboxService },
                {
                    provide: MAILER,
                    inject: [MAIL_SETTINGS, MAIL_OUTBOX, LOGGER],
                    useFactory: (
                        mail: MailOptions,
                        outbox: MailOutboxService,
                        logger: Logger,
                    ): SuppressingMailerService =>
                        new SuppressingMailerService(packageMailerFactory.create(mail), mail.suppress, outbox, logger),
                },
                { provide: MAIL_RELAY, useClass: MailRelayService },
            ],
            exports: [...(base.exports ?? []), MAILER, MAIL_SETTINGS, MAIL_OUTBOX, MAIL_RELAY],
            global: isGlobal === true,
        }
    }
}
