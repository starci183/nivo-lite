import type { DynamicModule } from "@nestjs/common"
import { AgentsService } from "@modules/domain/agents"
import { AvatarsModule } from "@modules/domain/avatars"
import { IDENTITY_ACCOUNTS } from "@modules/domain/identity"
import { STORAGE_OBJECTS } from "@modules/integrations/object-storage"
import { MessagesModule } from "@modules/domain/messages"
import { ResponsibilitiesModule } from "@modules/domain/responsibilities"
import { EventsModule } from "@modules/domain/events"
import { WorkspaceInvitesModule } from "@modules/domain/workspace-invites"
import { WorkspaceMembersModule } from "@modules/domain/workspace-members"
import { WorkspacesModule } from "@modules/domain/workspaces"
import { LeadsModule } from "@modules/domain/leads"
import { LeadFlowsModule } from "@modules/domain/lead-flows"
import type { ApiOptions } from "../api.options"
/** The identity area of the API, in registration order. */
export const identityModules = (options: ApiOptions): Array<DynamicModule> => [
    LeadsModule.register({ isGlobal: true }),
    LeadFlowsModule.register({ isGlobal: true }),
    MessagesModule.register({ isGlobal: true, agentDirectory: AgentsService }),
    ResponsibilitiesModule.register({ isGlobal: true, agentDirectory: AgentsService }),
    EventsModule.register({ isGlobal: true }),
    WorkspaceMembersModule.register({ isGlobal: true, accounts: IDENTITY_ACCOUNTS }),
    AvatarsModule.register({ isGlobal: true, storage: STORAGE_OBJECTS, accounts: IDENTITY_ACCOUNTS }),
    WorkspacesModule.register({ isGlobal: true, ...options.workspaces }),
    WorkspaceInvitesModule.register({
        isGlobal: true,
        delivery: IDENTITY_ACCOUNTS,
        ...options.workspaceInvites,
    }),
]
