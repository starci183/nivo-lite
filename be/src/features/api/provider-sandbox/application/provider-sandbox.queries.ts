import { Query } from "@nestjs/cqrs"
import type {
    SandboxCall,
    SandboxCase,
    SandboxLatestRequest,
    SandboxNextCase,
} from "@modules/domain/provider-sandbox"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type {
    SandboxAccountRequest,
    SandboxAccountView,
    SandboxCallsRequest,
    SandboxProviderRequest,
    SandboxWaitingRunView,
    SandboxWaitingRunsRequest,
    SandboxWorkspaceRequest,
} from "./provider-sandbox.contracts"

/** Whether the sandbox is on in this environment (the page hides itself when it is not). Never refuses. */
export class ProviderSandboxStateQuery extends Query<boolean> {
    constructor(readonly params: ExecuteParams<SandboxWorkspaceRequest>) {
        super()
    }
}

/** The providers that ship a sandbox catalogue. */
export class SandboxProvidersQuery extends Query<ReadonlyArray<string>> {
    constructor(readonly params: ExecuteParams<SandboxWorkspaceRequest>) {
        super()
    }
}

/** The workspace's sandbox accounts, each with the agents it is attached to. */
export class SandboxAccountsQuery extends Query<ReadonlyArray<SandboxAccountView>> {
    constructor(readonly params: ExecuteParams<SandboxWorkspaceRequest>) {
        super()
    }
}

/** A provider's hardcoded cases. */
export class SandboxCasesQuery extends Query<ReadonlyArray<SandboxCase>> {
    constructor(readonly params: ExecuteParams<SandboxProviderRequest>) {
        super()
    }
}

/** The request the agent last made of a sandbox account, read as inputs; null when it made none. */
export class SandboxLatestRequestQuery extends Query<SandboxLatestRequest | null> {
    constructor(readonly params: ExecuteParams<SandboxAccountRequest>) {
        super()
    }
}

/** The account's next case of each outbound operation. */
export class SandboxNextCasesQuery extends Query<ReadonlyArray<SandboxNextCase>> {
    constructor(readonly params: ExecuteParams<SandboxAccountRequest>) {
        super()
    }
}

/** The account's call log, oldest first. */
export class SandboxCallsQuery extends Query<ReadonlyArray<SandboxCall>> {
    constructor(readonly params: ExecuteParams<SandboxCallsRequest>) {
        super()
    }
}

/** The account's sandbox key. */
export class SandboxKeyQuery extends Query<string> {
    constructor(readonly params: ExecuteParams<SandboxAccountRequest>) {
        super()
    }
}

/** The runs of the workspace parked at a wait, labelled. */
export class SandboxWaitingRunsQuery extends Query<ReadonlyArray<SandboxWaitingRunView>> {
    constructor(readonly params: ExecuteParams<SandboxWaitingRunsRequest>) {
        super()
    }
}
