import { CommandHandler } from "@nestjs/cqrs"
import { InventoryDispatchService } from "@modules/domain/inventory"
import type { RequestSendOutput } from "@modules/domain/inventory"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RequestInventorySendCommand } from "./request-inventory-send.command"

@CommandHandler(RequestInventorySendCommand)
/** Put a purchase order before the owner to send, or to remind the supplier. */
export class RequestInventorySendHandler extends ICQRSHandler<RequestInventorySendCommand, RequestSendOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly dispatch: InventoryDispatchService,
    ) {
        super(logger)
    }

    protected override process(command: RequestInventorySendCommand): Promise<RequestSendOutput> {
        return this.dispatch.requestSend(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
