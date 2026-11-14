import { Module, type DynamicModule } from "@nestjs/common"
import { AGENTS_ROOMS, AgentOwnershipService, AgentsModule } from "@modules/domain/agents"
import { ModuleInstallationsModule } from "@modules/domain/module-installations"
import { EventsModule } from "@modules/domain/events"
import { ChatRoomDirectoryModule, ChatRoomDirectoryService } from "@modules/domain/chat-room-directory"
import { teamChatEntities } from "@modules/domain/team-chat"
import { StaffModule } from "@modules/domain/staff"
import { WorkspaceMembersModule, type AccountDirectory } from "@modules/domain/workspace-members"
import { WorkspacesModule } from "@modules/domain/workspaces"
import { ERRORS_MESSAGES, ErrorsModule } from "@modules/platform/errors"
import { I18nModule } from "@modules/platform/i18n"
import { TestWorldError, TestWorldErrorCode } from "./test-world.error"
import { OfficeChainQueueProofModule } from "./office-chain-queue-proof.module"

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
                { provide: AGENTS_ROOMS, useExisting: ChatRoomDirectoryService },
                { provide: OFFICE_ACCOUNTS, useClass: UnreadAccountDirectory },
            ],
            exports: [AgentOwnershipService, OFFICE_ACCOUNTS],
        }
    }
}

/**
 * The approval chain of the agents as the api composes it: the member grants and the rooms,
 * each port bound the way the app root binds it (the agent owners to the agents capability's ownership rules).
 */
export const OFFICE_CHAIN_MODULES: Array<DynamicModule> = [
    I18nModule.register({
        isGlobal: true,
        bundles: [ERRORS_MESSAGES],
    }),
    ErrorsModule.register({
        isGlobal: true,
        kinds: [],
    }),
    EventsModule.register({ isGlobal: true }),
    StaffModule.register({ isGlobal: true }),
    AgentsModule.register({ isGlobal: true, directoryOnly: true }),
    WorkspacesModule.register({ isGlobal: true, allowFreeWorkspace: false }),
    OfficeAgentOwnersModule.register(),
    WorkspaceMembersModule.register({ isGlobal: true, accounts: OFFICE_ACCOUNTS }),
    ModuleInstallationsModule.register({ isGlobal: true }),
    ChatRoomDirectoryModule.register({ isGlobal: true, rooms: teamChatEntities[0], seats: teamChatEntities[1] }),
    { module: OfficeChainQueueProofModule, global: true },
]
