import { CommandHandler } from "@nestjs/cqrs"
import { BrainPolicyDerivationsService, type PolicyDeriveRequested } from "@modules/domain/brain"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { DeriveBrainPoliciesCommand } from "./derive-brain-policies.command"

@CommandHandler(DeriveBrainPoliciesCommand)
/** Queues a derive pass of the workspace's policies; it never calls a model itself. */
export class DeriveBrainPoliciesHandler extends ICQRSHandler<DeriveBrainPoliciesCommand, PolicyDeriveRequested> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly derivations: BrainPolicyDerivationsService,
    ) {
        super(logger)
    }

    protected override process(command: DeriveBrainPoliciesCommand): Promise<PolicyDeriveRequested> {
        return this.derivations.requestFor(command.params.principal.id, command.params.request.workspaceId)
    }
}
