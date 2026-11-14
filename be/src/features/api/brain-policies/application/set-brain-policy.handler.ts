import { CommandHandler } from "@nestjs/cqrs"
import { BrainPoliciesService, type SetPolicyResult } from "@modules/domain/brain"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { SetBrainPolicyCommand } from "./set-brain-policy.command"

@CommandHandler(SetBrainPolicyCommand)
/** Sets a policy: the next version of its fact (the owner) or a proposal (a manager). */
export class SetBrainPolicyHandler extends ICQRSHandler<SetBrainPolicyCommand, SetPolicyResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly policies: BrainPoliciesService,
    ) {
        super(logger)
    }

    protected override process(command: SetBrainPolicyCommand): Promise<SetPolicyResult> {
        return this.policies.set(command.params.principal.id, command.params.request)
    }
}
