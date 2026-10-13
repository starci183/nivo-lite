import { CommandHandler } from "@nestjs/cqrs"
import { ShiftsRequestsService } from "@modules/domain/shifts"
import type { RequestOutput } from "@modules/domain/shifts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RequestShiftsSwapCommand } from "./request-shifts-swap.command"

@CommandHandler(RequestShiftsSwapCommand)
/** Hand a shift over or take an open one. */
export class RequestShiftsSwapHandler extends ICQRSHandler<RequestShiftsSwapCommand, RequestOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly requests: ShiftsRequestsService,
    ) {
        super(logger)
    }

    protected override process(command: RequestShiftsSwapCommand): Promise<RequestOutput> {
        return this.requests.requestSwap(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
