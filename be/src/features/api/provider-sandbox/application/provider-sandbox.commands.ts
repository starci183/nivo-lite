import { Command } from "@nestjs/cqrs"
import type { OpenedSandbox, SandboxNextCase, SandboxSendResult } from "@modules/domain/provider-sandbox"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type {
    ExpireSandboxWaitRequest,
    OpenSandboxAccountRequest,
    SandboxAccountRequest,
    SandboxAccountView,
    SandboxAgentRequest,
    SandboxWaitExpiryView,
    SendSandboxCaseRequest,
    SetSandboxNextCaseRequest,
} from "./provider-sandbox.contracts"

/** Opens a sandbox account of a provider: no credential, no secret. */
export class OpenSandboxAccountCommand extends Command<OpenedSandbox> {
    constructor(readonly params: ExecuteParams<OpenSandboxAccountRequest>) {
        super()
    }
}

/** Attaches an agent to a sandbox account (attached, bound, the provider's triggers on). */
export class AttachSandboxAccountCommand extends Command<SandboxAccountView> {
    constructor(readonly params: ExecuteParams<SandboxAgentRequest>) {
        super()
    }
}

/** Detaches an agent from a sandbox account (its binding removed, then the attachment). */
export class DetachSandboxAccountCommand extends Command<SandboxAccountView> {
    constructor(readonly params: ExecuteParams<SandboxAgentRequest>) {
        super()
    }
}

/** Sends one inbound case of the account's provider to the provider's own webhook route. */
export class SendSandboxCaseCommand extends Command<SandboxSendResult> {
    constructor(readonly params: ExecuteParams<SendSandboxCaseRequest>) {
        super()
    }
}

/** Picks the account's next case of one outbound operation. */
export class SetSandboxNextCaseCommand extends Command<SandboxNextCase> {
    constructor(readonly params: ExecuteParams<SetSandboxNextCaseRequest>) {
        super()
    }
}

/** Forgets the account's state, next cases and call log. */
export class ResetSandboxAccountCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<SandboxAccountRequest>) {
        super()
    }
}

/** Expires the wait of a parked run now, through the engine's real deadline road. */
export class ExpireSandboxWaitCommand extends Command<SandboxWaitExpiryView> {
    constructor(readonly params: ExecuteParams<ExpireSandboxWaitRequest>) {
        super()
    }
}
