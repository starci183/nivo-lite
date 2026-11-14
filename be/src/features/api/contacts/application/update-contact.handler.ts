import { CommandHandler } from "@nestjs/cqrs"
import { ContactsPageService, type ContactView } from "@modules/domain/contacts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { UpdateContactCommand } from "./contacts.commands"

@CommandHandler(UpdateContactCommand)
/** `nivo.api.nivo.contact.update`. */
export class UpdateContactHandler extends ICQRSHandler<UpdateContactCommand, ContactView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly page: ContactsPageService,
    ) {
        super(logger)
    }

    protected override process(command: UpdateContactCommand): Promise<ContactView> {
        return this.page.update(command.params.principal.id, command.params.request)
    }
}
