import { Module, type DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./email-messages.module-definition"
import { EmailMessagesService } from "./email-messages.service"
import { EmailMessagesLedgerService } from "./email-messages-ledger.service"
import { SmtpLiveSendService } from "./smtp-live-send.service"
import { SmtpSandboxSendService } from "./smtp-sandbox-send.service"
import { SmtpSendRegistrationService } from "./smtp-send-registration.service"
import { SmtpSendRegistryService } from "./smtp-send-registry.service"
import { SmtpConnectionFieldsService } from "./smtp-connection-fields.service"
import { SmtpWizardService } from "./smtp-wizard.service"
import { WorkspaceMailService } from "./workspace-mail.service"

@Module({})
/** The email log of a workspace and the sending of its mail over the primary PostgreSQL connection: the only writer of public.email_messages. */
export class EmailMessagesModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                EmailMessagesService,
                EmailMessagesLedgerService,
                WorkspaceMailService,
                SmtpSendRegistryService,
                SmtpLiveSendService,
                SmtpSandboxSendService,
                SmtpSendRegistrationService,
                SmtpWizardService,
                SmtpConnectionFieldsService,
            ],
            exports: [
                EmailMessagesService,
                EmailMessagesLedgerService,
                WorkspaceMailService,
                SmtpWizardService,
                SmtpConnectionFieldsService,
            ],
        }
    }
}
