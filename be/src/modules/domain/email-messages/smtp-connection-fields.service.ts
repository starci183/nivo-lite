import { Injectable } from "@nestjs/common"
import type { ActionAnswer, ConnectionFieldChange, ConnectionFieldWriter, ProviderFieldsDeclaration } from "@modules/domain/connection-fields"
import { ConnectionsService, type ConnectionActor, type ConnectionRecord } from "@modules/domain/connections"
import { EmailMessagesError, EmailMessagesErrorCode } from "./errors/email-messages.error"
import { SMTP_FIELD_DECLARATIONS, SMTP_SET_DEFAULT, SMTP_TEST_SEND } from "./smtp-connection-fields.policy"
import { SmtpWizardService } from "./smtp-wizard.service"

@Injectable()
/**
 * The connection form writer of an SMTP sender: the password through `changePassword` (the wizard's own write), the name through the
 * connections rename, and the two actions through the wizard's own `sendTest` and `setDefault`.
 */
export class SmtpConnectionFieldsService implements ConnectionFieldWriter {
    /** The form of an SMTP sender. */
    readonly declarations: ReadonlyArray<ProviderFieldsDeclaration> = SMTP_FIELD_DECLARATIONS

    constructor(
        private readonly wizard: SmtpWizardService,
        private readonly connections: ConnectionsService,
    ) {}

    /** Replaces the password when one is given, then renames when asked. */
    async write(actor: ConnectionActor, connection: ConnectionRecord, change: ConnectionFieldChange): Promise<void> {
        const password = change.values.password
        if (password !== undefined) await this.wizard.changePassword(actor, connection.id, password)
        if (change.displayName !== null) await this.connections.rename(actor, connection.id, change.displayName)
    }

    /** Sends a test email or makes the sender the default, through the wizard's own service. */
    async run(
        actor: ConnectionActor,
        connection: ConnectionRecord,
        action: string,
        inputs: Readonly<Record<string, string>>,
    ): Promise<ActionAnswer> {
        if (action === SMTP_TEST_SEND) {
            const sent = await this.wizard.sendTest(actor, { connectionId: connection.id, to: inputs.to ?? "", makeDefault: false })
            return { to: sent.to, isDefault: String(sent.isDefault) }
        }
        if (action === SMTP_SET_DEFAULT) {
            await this.wizard.setDefault(actor, connection.id)
            return {}
        }
        throw new EmailMessagesError({ code: EmailMessagesErrorCode.SmtpNone })
    }
}
