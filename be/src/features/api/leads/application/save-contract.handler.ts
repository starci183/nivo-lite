import { CommandHandler } from "@nestjs/cqrs"
import { ContractsService } from "@modules/domain/contracts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SaveContractCommand } from "./save-contract.command"
import type { SaveContractResult } from "./save-contract.contracts"

@CommandHandler(SaveContractCommand)
/** Saves a recurring sales contract through one domain-service call. */
export class SaveContractHandler extends ICQRSHandler<SaveContractCommand, SaveContractResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly contractsService: ContractsService,
    ) {
        super(logger)
    }

    protected override process(command: SaveContractCommand): Promise<SaveContractResult> {
        return this.contractsService.saveContract(command.params.request)
    }
}
