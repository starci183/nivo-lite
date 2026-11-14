import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { Args, ID, Int, Mutation, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import {
    AttachSandboxAccountCommand,
    DetachSandboxAccountCommand,
    ExpireSandboxWaitCommand,
    OpenSandboxAccountCommand,
    ResetSandboxAccountCommand,
    SendSandboxCaseCommand,
    SetSandboxNextCaseCommand,
} from "../../application/provider-sandbox.commands"
import {
    ProviderSandboxStateQuery,
    SandboxAccountsQuery,
    SandboxCallsQuery,
    SandboxCasesQuery,
    SandboxKeyQuery,
    SandboxLatestRequestQuery,
    SandboxNextCasesQuery,
    SandboxProvidersQuery,
    SandboxWaitingRunsQuery,
} from "../../application/provider-sandbox.queries"
import {
    ExpireSandboxWaitInput,
    OpenSandboxAccountInput,
    SandboxAccountAgentInput,
    SendSandboxCaseInput,
    SetSandboxNextCaseInput,
} from "./dto/provider-sandbox.inputs"
import {
    OpenedSandboxAccountType,
    ProviderSandboxStateType,
    SandboxAccountType,
    SandboxCallType,
    SandboxCaseType,
    SandboxLatestRequestType,
    SandboxNextCaseType,
    SandboxSendResultType,
    SandboxWaitExpiryType,
    SandboxWaitingRunType,
} from "./dto/provider-sandbox.types"
import {
    toExpireSandboxWaitRequest,
    toOpenSandboxAccountRequest,
    toOpenedSandboxAccountType,
    toSandboxAccountRequest,
    toSandboxAccountType,
    toSandboxAgentRequest,
    toSandboxCallType,
    toSandboxCallsRequest,
    toSandboxCaseType,
    toSandboxLatestRequestType,
    toSandboxNextCaseType,
    toSandboxProviderRequest,
    toSandboxSendResultType,
    toSandboxWaitingRunsRequest,
    toSandboxWorkspaceRequest,
    toSendSandboxCaseRequest,
    toSetSandboxNextCaseRequest,
} from "./provider-sandbox.mapper"

@Resolver()
/**
 * GraphQL door of the dev Sandbox page (rulings R60, R62, R66): every op but `providerSandbox` is for an owner or manager and is
 * refused with PROVIDER_SANDBOX_OFF while the dev switch is off.
 */
export class ProviderSandboxResolver {
    constructor(
        @InjectQueryBus() private readonly queryBus: QueryBus,
        @InjectCommandBus() private readonly commandBus: CommandBus,
    ) {}

    /** Whether the sandbox is on in this environment; never refuses, so the page can hide itself. */
    @Query(() => ProviderSandboxStateType, { name: "providerSandbox" })
    async providerSandbox(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<ProviderSandboxStateType> {
        const enabled = await this.queryBus.execute(
            new ProviderSandboxStateQuery({ request: toSandboxWorkspaceRequest(workspaceId), principal }),
        )
        return { enabled }
    }

    /** The providers that ship a sandbox catalogue. */
    @Query(() => [String], { name: "sandboxProviders" })
    async sandboxProviders(@CurrentPrincipal() principal: Principal, @WorkspaceId() workspaceId: string): Promise<Array<string>> {
        const providers = await this.queryBus.execute(
            new SandboxProvidersQuery({ request: toSandboxWorkspaceRequest(workspaceId), principal }),
        )
        return [...providers]
    }

    /** The workspace's sandbox accounts. */
    @Query(() => [SandboxAccountType], { name: "sandboxAccounts" })
    async sandboxAccounts(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<Array<SandboxAccountType>> {
        const accounts = await this.queryBus.execute(
            new SandboxAccountsQuery({ request: toSandboxWorkspaceRequest(workspaceId), principal }),
        )
        return accounts.map(toSandboxAccountType)
    }

    /** A provider's hardcoded cases. */
    @Query(() => [SandboxCaseType], { name: "sandboxCases" })
    async sandboxCases(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("provider", { type: () => String }) provider: string,
    ): Promise<Array<SandboxCaseType>> {
        const cases = await this.queryBus.execute(
            new SandboxCasesQuery({ request: toSandboxProviderRequest(workspaceId, provider), principal }),
        )
        return cases.map(toSandboxCaseType)
    }

    /** The request the agent last made of the account, read as inputs; null when it made none. */
    @Query(() => SandboxLatestRequestType, { name: "sandboxLatestRequest", nullable: true })
    async sandboxLatestRequest(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("connectionId", { type: () => ID }) connectionId: string,
    ): Promise<SandboxLatestRequestType | null> {
        const latest = await this.queryBus.execute(
            new SandboxLatestRequestQuery({ request: toSandboxAccountRequest(workspaceId, connectionId), principal }),
        )
        return toSandboxLatestRequestType(latest)
    }

    /** The account's next case of each outbound operation. */
    @Query(() => [SandboxNextCaseType], { name: "sandboxNextCases" })
    async sandboxNextCases(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("connectionId", { type: () => ID }) connectionId: string,
    ): Promise<Array<SandboxNextCaseType>> {
        const next = await this.queryBus.execute(
            new SandboxNextCasesQuery({ request: toSandboxAccountRequest(workspaceId, connectionId), principal }),
        )
        return next.map(toSandboxNextCaseType)
    }

    /** The account's call log, oldest first; of one operation when it is named. */
    @Query(() => [SandboxCallType], { name: "sandboxCalls" })
    async sandboxCalls(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("connectionId", { type: () => ID }) connectionId: string,
        @Args("operation", { type: () => String, nullable: true }) operation?: string | null,
    ): Promise<Array<SandboxCallType>> {
        const calls = await this.queryBus.execute(
            new SandboxCallsQuery({ request: toSandboxCallsRequest(workspaceId, connectionId, operation), principal }),
        )
        return calls.map(toSandboxCallType)
    }

    /** The account's sandbox key, for a test caller of its webhook. */
    @Query(() => String, { name: "sandboxKey" })
    sandboxKey(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("connectionId", { type: () => ID }) connectionId: string,
    ): Promise<string> {
        return this.queryBus.execute(new SandboxKeyQuery({ request: toSandboxAccountRequest(workspaceId, connectionId), principal }))
    }

    /** The runs of the workspace parked at a wait, newest first (default 20, at most 50). */
    @Query(() => [SandboxWaitingRunType], { name: "sandboxWaitingRuns" })
    async sandboxWaitingRuns(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("limit", { type: () => Int, nullable: true }) limit?: number | null,
    ): Promise<Array<SandboxWaitingRunType>> {
        const runs = await this.queryBus.execute(
            new SandboxWaitingRunsQuery({ request: toSandboxWaitingRunsRequest(workspaceId, limit), principal }),
        )
        return runs.map((run) => ({ ...run }))
    }

    /** Opens a sandbox account of a provider (no credential, no secret) and gives it to the agents in `attachTo` in the same action. */
    @Mutation(() => OpenedSandboxAccountType, { name: "openSandboxAccount" })
    async openSandboxAccount(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: OpenSandboxAccountInput,
    ): Promise<OpenedSandboxAccountType> {
        const opened = await this.commandBus.execute(
            new OpenSandboxAccountCommand({ request: toOpenSandboxAccountRequest(workspaceId, input), principal }),
        )
        return toOpenedSandboxAccountType(opened)
    }

    /** Attaches an agent to a sandbox account: attached, bound where it may be, the provider's triggers on. */
    @Mutation(() => SandboxAccountType, { name: "attachSandboxAccount" })
    async attachSandboxAccount(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SandboxAccountAgentInput,
    ): Promise<SandboxAccountType> {
        const view = await this.commandBus.execute(
            new AttachSandboxAccountCommand({ request: toSandboxAgentRequest(workspaceId, input), principal }),
        )
        return toSandboxAccountType(view)
    }

    /** Detaches an agent from a sandbox account: its binding removed, then the attachment. */
    @Mutation(() => SandboxAccountType, { name: "detachSandboxAccount" })
    async detachSandboxAccount(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SandboxAccountAgentInput,
    ): Promise<SandboxAccountType> {
        const view = await this.commandBus.execute(
            new DetachSandboxAccountCommand({ request: toSandboxAgentRequest(workspaceId, input), principal }),
        )
        return toSandboxAccountType(view)
    }

    /** Sends one inbound case to the provider's own webhook route and answers what NIVO's route did. */
    @Mutation(() => SandboxSendResultType, { name: "sendSandboxCase" })
    async sendSandboxCase(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SendSandboxCaseInput,
    ): Promise<SandboxSendResultType> {
        const result = await this.commandBus.execute(
            new SendSandboxCaseCommand({ request: toSendSandboxCaseRequest(workspaceId, input), principal }),
        )
        return toSandboxSendResultType(result)
    }

    /** Picks the account's next case of that case's own operation (sticky until changed). */
    @Mutation(() => SandboxNextCaseType, { name: "setSandboxNextCase" })
    async setSandboxNextCase(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SetSandboxNextCaseInput,
    ): Promise<SandboxNextCaseType> {
        const next = await this.commandBus.execute(
            new SetSandboxNextCaseCommand({ request: toSetSandboxNextCaseRequest(workspaceId, input), principal }),
        )
        return toSandboxNextCaseType(next)
    }

    /** Forgets the account's state, next cases and call log. */
    @Mutation(() => Boolean, { name: "resetSandboxAccount" })
    async resetSandboxAccount(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("connectionId", { type: () => ID }) connectionId: string,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new ResetSandboxAccountCommand({ request: toSandboxAccountRequest(workspaceId, connectionId), principal }),
        )
        return true
    }

    /** Expires the wait of a parked run now, through the engine's real deadline road. */
    @Mutation(() => SandboxWaitExpiryType, { name: "expireSandboxWait" })
    async expireSandboxWait(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ExpireSandboxWaitInput,
    ): Promise<SandboxWaitExpiryType> {
        return this.commandBus.execute(
            new ExpireSandboxWaitCommand({ request: toExpireSandboxWaitRequest(workspaceId, input), principal }),
        )
    }
}
