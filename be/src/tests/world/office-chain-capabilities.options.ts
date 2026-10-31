import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AgentOwnershipService, AgentsModule } from "@modules/domain/agents"
import {
    APPROVAL_REQUESTS_ERROR_KINDS,
    APPROVAL_REQUESTS_MESSAGES,
    ApprovalRequestsModule,
    ApprovalRequestsService,
} from "@modules/domain/approval-requests"
import { AuthorityActionsService } from "@modules/domain/authority-actions"
import { ModuleInstallationsModule } from "@modules/domain/module-installations"
import { LeadReadService } from "@modules/domain/leads"
import { OrdersService } from "@modules/domain/orders"
import {
    AUTHORITY_RULES_ERROR_KINDS,
    AUTHORITY_RULES_MESSAGES,
    AuthorityRulesModule,
} from "@modules/domain/authority-rules"
import { EventsModule } from "@modules/domain/events"
import { MEMBER_GRANTS_ERROR_KINDS, MEMBER_GRANTS_MESSAGES, MemberGrantsModule } from "@modules/domain/member-grants"
import { OfficeRoomDirectoryService } from "@modules/domain/office-rooms"
import { StaffModule } from "@modules/domain/staff"
import {
    THREAD_MESSAGES_ERROR_KINDS,
    THREAD_MESSAGES_MESSAGES,
    ThreadAgentPostsService,
    ThreadMessagesModule,
} from "@modules/domain/thread-messages"
import { WORK_CHAINS_ERROR_KINDS, WORK_CHAINS_MESSAGES, WorkChainsModule } from "@modules/domain/work-chains"
import { WORK_THREADS_ERROR_KINDS, WORK_THREADS_MESSAGES, WorkThreadsModule } from "@modules/domain/work-threads"
import { WorkspaceMembersModule } from "@modules/domain/workspace-members"
import { WorkspacesModule } from "@modules/domain/workspaces"
import type { AccountDirectory } from "@modules/domain/workspace-members"
import { ERRORS_MESSAGES, ErrorsModule } from "@modules/platform/errors"
import { I18nModule } from "@modules/platform/i18n"
import type { LiteWorld } from "./lite-world.service"
import { TestWorldError, TestWorldErrorCode } from "./test-world.error"

/** The token of the Auth account directory of the office chain proofs. */
const OFFICE_ACCOUNTS = Symbol("proof.office-chain.accounts")

/** The Auth account directory of the office chain: no path of the chain reads an account, so a read is a failed proof. */
class UnreadAccountDirectory implements AccountDirectory {
    accountOf(): ReturnType<AccountDirectory["accountOf"]> {
        const unread: Error = new TestWorldError({ code: TestWorldErrorCode.AccountsUnread })
        return Promise.reject(unread)
    }
}

@Module({})
class OfficeAgentOwnersModule {
    /** The agents' ownership rules of the agents capability and the account directory of the proofs, global for the chain. */
    static register(): DynamicModule {
        return {
            module: OfficeAgentOwnersModule,
            global: true,
            providers: [
                AgentOwnershipService,
                OfficeRoomDirectoryService,
                AuthorityActionsService,
                LeadReadService,
                OrdersService,
                { provide: OFFICE_ACCOUNTS, useClass: UnreadAccountDirectory },
            ],
            exports: [
                AgentOwnershipService,
                OfficeRoomDirectoryService,
                AuthorityActionsService,
                LeadReadService,
                OrdersService,
                OFFICE_ACCOUNTS,
            ],
        }
    }
}

/**
 * The v0.3.2 office chain as the api composes it: the work threads, the chain and the messages, the approval requests over the
 * authority rules and the member grants, each port bound the way the app root binds it (the agent rules and owners to the
 * agents capability's ownership rules, the approval gate to the approval requests, `approval.resolved` to the thread cards).
 */
export const OFFICE_CHAIN_MODULES = [
    I18nModule.register({
        isGlobal: true,
        bundles: [
            APPROVAL_REQUESTS_MESSAGES,
            AUTHORITY_RULES_MESSAGES,
            ERRORS_MESSAGES,
            MEMBER_GRANTS_MESSAGES,
            THREAD_MESSAGES_MESSAGES,
            WORK_CHAINS_MESSAGES,
            WORK_THREADS_MESSAGES,
        ],
    }),
    ErrorsModule.register({
        isGlobal: true,
        kinds: [
            APPROVAL_REQUESTS_ERROR_KINDS,
            AUTHORITY_RULES_ERROR_KINDS,
            MEMBER_GRANTS_ERROR_KINDS,
            THREAD_MESSAGES_ERROR_KINDS,
            WORK_CHAINS_ERROR_KINDS,
            WORK_THREADS_ERROR_KINDS,
        ],
    }),
    EventsModule.register({ isGlobal: true }),
    StaffModule.register({ isGlobal: true }),
    AgentsModule.register({ isGlobal: true, directoryOnly: true }),
    WorkspacesModule.register({ isGlobal: true, allowFreeWorkspace: false }),
    OfficeAgentOwnersModule.register(),
    WorkspaceMembersModule.register({ isGlobal: true, accounts: OFFICE_ACCOUNTS }),
    ModuleInstallationsModule.register({ isGlobal: true }),
    AuthorityRulesModule.register({ isGlobal: true }),
    MemberGrantsModule.register({ isGlobal: true }),
    WorkChainsModule.register({ isGlobal: true, ownerDirectory: AgentOwnershipService }),
    WorkThreadsModule.register({ isGlobal: true }),
    ThreadMessagesModule.register({
        isGlobal: true,
        agentRules: AgentOwnershipService,
        approvalGate: ApprovalRequestsService,
    }),
    ApprovalRequestsModule.register({
        isGlobal: true,
        ports: { agentOwners: AgentOwnershipService },
    }),
]

/** The door the agents write through in a thread (an agent's turn: its tags, its hand-offs and its approval asks). */
export const agentPostsOf = (world: LiteWorld): ThreadAgentPostsService => world.resolve(ThreadAgentPostsService)
