import { CommandHandler } from "@nestjs/cqrs"
import { BrainPoliciesService, type UnsetPolicyResult } from "@modules/domain/brain"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { UnsetBrainPolicyCommand } from "./set-brain-policy.command"

@CommandHandler(UnsetBrainPolicyCommand)
/** Takes a policy out of force (the owner) or asks the owner to (a manager). */
export class UnsetBrainPolicyHandler extends ICQRSHandler<UnsetBrainPolicyCommand, UnsetPolicyResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly policies: BrainPoliciesService,
    ) {
        super(logger)
    }

    protected override process(command: UnsetBrainPolicyCommand): Promise<UnsetPolicyResult> {
        return this.policies.unset(command.params.principal.id, command.params.request)
    }
}
