import { Command } from "@nestjs/cqrs"
import type { SetPolicyRequest, SetPolicyResult, UnsetPolicyRequest, UnsetPolicyResult } from "@modules/domain/brain"
import type { ExecuteParams } from "@modules/platform/cqrs"

/** Sets a policy: the owner writes the next version of its fact; a manager files a proposal. */
export class SetBrainPolicyCommand extends Command<SetPolicyResult> {
    constructor(readonly params: ExecuteParams<SetPolicyRequest>) {
        super()
    }
}

/** Takes a policy out of force: the owner retires its value; a manager files a proposal to stop using it. */
export class UnsetBrainPolicyCommand extends Command<UnsetPolicyResult> {
    constructor(readonly params: ExecuteParams<UnsetPolicyRequest>) {
        super()
    }
}
