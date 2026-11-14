import { CommandHandler } from "@nestjs/cqrs"
import { ContactsPageService } from "@modules/domain/contacts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { DeleteContactCommand } from "./contacts.commands"

@CommandHandler(DeleteContactCommand)
/** `nivo.api.nivo.contact.delete`. */
export class DeleteContactHandler extends ICQRSHandler<DeleteContactCommand, boolean> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly page: ContactsPageService,
    ) {
        super(logger)
    }

    protected override process(command: DeleteContactCommand): Promise<boolean> {
        return this.page.delete(command.params.principal.id, command.params.request)
    }
}
