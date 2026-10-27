import { CommandHandler } from "@nestjs/cqrs"
import { ContractsService } from "@modules/domain/contracts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { LinkContractCustomersCommand } from "./link-contract-customers.command"
import type { LinkContractCustomersResult } from "./link-contract-customers.contracts"

@CommandHandler(LinkContractCustomersCommand)
/** Links the contracts of a workspace to their customers through one domain-service call. */
export class LinkContractCustomersHandler extends ICQRSHandler<
    LinkContractCustomersCommand,
    LinkContractCustomersResult
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly contractsService: ContractsService,
    ) {
        super(logger)
    }

    protected override process(command: LinkContractCustomersCommand): Promise<LinkContractCustomersResult> {
        return this.contractsService.linkCustomersFor(command.params.principal.id, command.params.request.workspaceId)
    }
}
