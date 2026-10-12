import { CommandHandler } from "@nestjs/cqrs"
import { InventoryDispatchService } from "@modules/domain/inventory"
import type { RequestSendOutput } from "@modules/domain/inventory"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RequestSendCommand } from "./request-send.command"

@CommandHandler(RequestSendCommand)
/** Handles put a purchase order before the owner to send through one domain-service call. */
export class RequestSendHandler extends ICQRSHandler<RequestSendCommand, RequestSendOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly inventoryDispatchService: InventoryDispatchService,
    ) {
        super(logger)
    }

    protected override process(command: RequestSendCommand): Promise<RequestSendOutput> {
        return this.inventoryDispatchService.requestSend(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.input,
        )
    }
}
