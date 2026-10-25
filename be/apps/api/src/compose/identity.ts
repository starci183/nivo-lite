import type { DynamicModule } from "@nestjs/common"
import { AgentsService } from "@modules/domain/agents"
import { AvatarsModule } from "@modules/domain/avatars"
import { SUPABASE_AUTH, SUPABASE_OBJECTS } from "@modules/integrations/supabase"
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
    WorkspaceMembersModule.register({ isGlobal: true, accounts: SUPABASE_AUTH }),
    AvatarsModule.register({ isGlobal: true, storage: SUPABASE_OBJECTS, accounts: SUPABASE_AUTH }),
    WorkspacesModule.register({ isGlobal: true, ...options.workspaces }),
    WorkspaceInvitesModule.register({
        isGlobal: true,
        delivery: SUPABASE_AUTH,
        ...options.workspaceInvites,
    }),
]
