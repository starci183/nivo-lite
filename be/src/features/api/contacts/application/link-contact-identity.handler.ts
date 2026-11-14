import { CommandHandler } from "@nestjs/cqrs"
import { ContactsPageService, type LinkContactIdentityView } from "@modules/domain/contacts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { LinkContactIdentityCommand } from "./contacts.commands"

@CommandHandler(LinkContactIdentityCommand)
/** `nivo.api.nivo.contact.identity.link`. */
export class LinkContactIdentityHandler extends ICQRSHandler<LinkContactIdentityCommand, LinkContactIdentityView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly page: ContactsPageService,
    ) {
        super(logger)
    }

    protected override process(command: LinkContactIdentityCommand): Promise<LinkContactIdentityView> {
        return this.page.link(command.params.principal.id, command.params.request)
    }
}
