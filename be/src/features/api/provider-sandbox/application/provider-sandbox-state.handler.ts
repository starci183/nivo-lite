import { QueryHandler } from "@nestjs/cqrs"
import { ProviderSandboxAccountsService } from "@modules/domain/provider-sandbox"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ProviderSandboxStateQuery } from "./provider-sandbox.queries"

@QueryHandler(ProviderSandboxStateQuery)
/** Asks whether the dev sandbox is switched on; it never refuses, so the page can hide itself. */
export class ProviderSandboxStateHandler extends ICQRSHandler<ProviderSandboxStateQuery, boolean> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly accounts: ProviderSandboxAccountsService,
    ) {
        super(logger)
    }

    protected override process(): Promise<boolean> {
        return Promise.resolve(this.accounts.enabled())
    }
}
