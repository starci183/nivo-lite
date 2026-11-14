import { CommandHandler } from "@nestjs/cqrs"
import { ContactsPageService, type ContactView } from "@modules/domain/contacts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { UnlinkContactIdentityCommand } from "./contacts.commands"

@CommandHandler(UnlinkContactIdentityCommand)
/** `nivo.api.nivo.contact.identity.unlink`. */
export class UnlinkContactIdentityHandler extends ICQRSHandler<UnlinkContactIdentityCommand, ContactView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly page: ContactsPageService,
    ) {
        super(logger)
    }

    protected override process(command: UnlinkContactIdentityCommand): Promise<ContactView> {
        return this.page.unlink(command.params.principal.id, command.params.request)
    }
}
