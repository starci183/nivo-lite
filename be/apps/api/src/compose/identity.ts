import type { DynamicModule } from "@nestjs/common"
import { AgentsService } from "@modules/domain/agents"
import { AVATARS_ERROR_KINDS, AVATARS_MESSAGES, AvatarsModule } from "@modules/domain/avatars"
import { IDENTITY_ACCOUNTS } from "@modules/domain/identity"
import { STORAGE_OBJECTS } from "@modules/integrations/object-storage"
import { MESSAGES_ERROR_KINDS, MESSAGES_MESSAGES, MessagesModule } from "@modules/domain/messages"
import {
    RESPONSIBILITIES_ERROR_KINDS,
    RESPONSIBILITIES_MESSAGES,
    ResponsibilitiesModule,
    RESPONSIBILITY_JOURNAL_MESSAGES,
} from "@modules/domain/responsibilities"
import { EventsModule } from "@modules/domain/events"
import {
    WORKSPACE_INVITES_ERROR_KINDS,
    WORKSPACE_INVITES_MESSAGES,
    WorkspaceInvitesModule,
} from "@modules/domain/workspace-invites"
import {
    WORKSPACE_MEMBERS_ERROR_KINDS,
    WORKSPACE_MEMBERS_MESSAGES,
    WorkspaceMembersModule,
} from "@modules/domain/workspace-members"
import { WORKSPACES_ERROR_KINDS, WORKSPACES_MESSAGES, WorkspacesModule } from "@modules/domain/workspaces"
import { LEADS_ERROR_KINDS, LEADS_MESSAGES, LeadsModule } from "@modules/domain/leads"
import { LeadFlowsModule } from "@modules/domain/lead-flows"
import type { ApiOptions } from "../api.options"
import type { ErrorKind } from "@modules/platform/errors"
import type { MessageBundle } from "@modules/platform/i18n"
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

/** The error kinds of the capabilities this group registers, in registration order. */
export const identityErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [
    RESPONSIBILITIES_ERROR_KINDS,
    LEADS_ERROR_KINDS,
    WORKSPACE_INVITES_ERROR_KINDS,
    WORKSPACE_MEMBERS_ERROR_KINDS,
    WORKSPACES_ERROR_KINDS,
    MESSAGES_ERROR_KINDS,
    AVATARS_ERROR_KINDS,
]

/** The message bundles of the capabilities this group registers, in registration order. */
export const identityMessages: ReadonlyArray<MessageBundle> = [
    RESPONSIBILITY_JOURNAL_MESSAGES,
    LEADS_MESSAGES,
    RESPONSIBILITIES_MESSAGES,
    WORKSPACE_INVITES_MESSAGES,
    WORKSPACE_MEMBERS_MESSAGES,
    WORKSPACES_MESSAGES,
    MESSAGES_MESSAGES,
    AVATARS_MESSAGES,
]
