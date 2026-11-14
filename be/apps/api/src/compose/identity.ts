import type { DynamicModule } from "@nestjs/common"
import { AVATARS_ERROR_KINDS, AVATARS_MESSAGES, AvatarsModule } from "@modules/domain/avatars"
import { IDENTITY_ACCOUNTS } from "@modules/domain/identity"
import { STORAGE_OBJECTS } from "@modules/integrations/object-storage"
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
import { STAFF_ERROR_KINDS, STAFF_MESSAGES, StaffModule } from "@modules/domain/staff"
import { WorkspaceDashboardModule } from "@modules/domain/workspace-dashboard"
import type { ApiOptions } from "../api.options"
import type { ErrorKind } from "@modules/platform/errors"
import type { MessageBundle } from "@modules/platform/i18n"
/** The identity area of the API, in registration order. */
export const identityModules = (options: ApiOptions): Array<DynamicModule> => [
    EventsModule.register({ isGlobal: true }),
    WorkspaceMembersModule.register({ isGlobal: true, accounts: IDENTITY_ACCOUNTS }),
    AvatarsModule.register({ isGlobal: true, storage: STORAGE_OBJECTS, accounts: IDENTITY_ACCOUNTS }),
    WorkspacesModule.register({ isGlobal: true, ...options.workspaces }),
    StaffModule.register({ isGlobal: true }),
    WorkspaceDashboardModule.register({ isGlobal: true }),
    WorkspaceInvitesModule.register({
        isGlobal: true,
        delivery: IDENTITY_ACCOUNTS,
        ...options.workspaceInvites,
    }),
]

/** The error kinds of the capabilities this group registers, in registration order. */
export const identityErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [
    WORKSPACE_INVITES_ERROR_KINDS,
    WORKSPACE_MEMBERS_ERROR_KINDS,
    WORKSPACES_ERROR_KINDS,
    AVATARS_ERROR_KINDS,
    STAFF_ERROR_KINDS,
]

/** The message bundles of the capabilities this group registers, in registration order. */
export const identityMessages: ReadonlyArray<MessageBundle> = [
    WORKSPACE_INVITES_MESSAGES,
    WORKSPACE_MEMBERS_MESSAGES,
    WORKSPACES_MESSAGES,
    AVATARS_MESSAGES,
    STAFF_MESSAGES,
]
