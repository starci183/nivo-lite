import { CommandHandler } from "@nestjs/cqrs"
import { ContactsPageService } from "@modules/domain/contacts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ForgetContactMemoryCommand } from "./contacts.commands"

@CommandHandler(ForgetContactMemoryCommand)
/** `nivo.api.nivo.contact.memory.forget`. */
export class ForgetContactMemoryHandler extends ICQRSHandler<ForgetContactMemoryCommand, ReadonlyArray<string>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly page: ContactsPageService,
    ) {
        super(logger)
    }

    protected override process(command: ForgetContactMemoryCommand): Promise<ReadonlyArray<string>> {
        return this.page.forget(command.params.principal.id, command.params.request)
    }
}
