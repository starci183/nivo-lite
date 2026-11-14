import { Injectable } from "@nestjs/common"
import { DEFAULT_TIME_ZONE } from "@nivo-lite/agent-sdk/port"
import { IsNull, type EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { WorkspaceEntity, WorkspacesError, WorkspacesErrorCode } from "@modules/domain/workspaces"
import type { WorkspaceSettings, WorkspaceSettingsChange, WorkspaceTheme } from "./workspace-settings.contracts"
import { validWorkspaceTheme } from "./workspace-theme.policy"
import { isKnownTimeZone, timeZoneOrDefault } from "./workspace-time-zone.policy"

/** The workspace columns a settings change writes. */
type SettingsColumns = Partial<Pick<WorkspaceEntity, "name" | "timeZone" | "logoUrl">>

/** The longest workspace name. */
const NAME_MAX = 120

@Injectable()
/**
 * The ONE core service for the workspace's own facts: its name, time zone and logo (columns of the core `workspaces` table, not a
 * record). It answers them to the server and to the node context, and writes them; it takes no caller, so who may change them is
 * the business of the door in front of it (`WorkspaceSettingsAccessService`).
 */
export class WorkspaceSettingsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The settings of a living workspace; the time zone is the default when the stored name is no zone the platform knows. */
    async get(workspaceId: string): Promise<WorkspaceSettings> {
        const row = await this.entityManager.findOne(WorkspaceEntity, {
            select: { id: true, name: true, timeZone: true, logoUrl: true },
            where: { id: workspaceId, deletedAt: IsNull() },
        })
        if (row === null) throw new WorkspacesError({ code: WorkspacesErrorCode.NotFound })
        return {
            name: row.name,
            timeZone: timeZoneOrDefault(row.timeZone, DEFAULT_TIME_ZONE),
            logoUrl: row.logoUrl,
        }
    }

    /** Saves the members the change carries and answers the settings as they are now; nothing is written for an empty change. */
    async update(workspaceId: string, change: WorkspaceSettingsChange): Promise<WorkspaceSettings> {
        const columns = this.columnsOf(change)
        if (Object.keys(columns).length > 0) {
            const result = await this.entityManager.update(
                WorkspaceEntity,
                { id: workspaceId, deletedAt: IsNull() },
                columns,
            )
            if ((result.affected ?? 0) === 0) throw new WorkspacesError({ code: WorkspacesErrorCode.NotFound })
        }
        return this.get(workspaceId)
    }

    /** The theme the workspace chose; null while it wears the NIVO default (also when the stored value no longer passes the policy). */
    async getTheme(workspaceId: string): Promise<WorkspaceTheme | null> {
        const row = await this.entityManager.findOne(WorkspaceEntity, {
            select: { id: true, theme: true },
            where: { id: workspaceId, deletedAt: IsNull() },
        })
        if (row === null) throw new WorkspacesError({ code: WorkspacesErrorCode.NotFound })
        return row.theme === null ? null : validWorkspaceTheme(row.theme)
    }

    /** Saves the theme (every member checked by range and list) or, given null, returns the workspace to the NIVO default. */
    async setTheme(workspaceId: string, theme: unknown): Promise<WorkspaceTheme | null> {
        const valid = theme === null ? null : validWorkspaceTheme(theme)
        if (theme !== null && valid === null) throw new WorkspacesError({ code: WorkspacesErrorCode.ThemeInvalid })
        const result = await this.entityManager.update(WorkspaceEntity, { id: workspaceId, deletedAt: IsNull() }, { theme: valid })
        if ((result.affected ?? 0) === 0) throw new WorkspacesError({ code: WorkspacesErrorCode.NotFound })
        return valid
    }

    private columnsOf(change: WorkspaceSettingsChange): SettingsColumns {
        const columns: SettingsColumns = {}
        if (change.name !== undefined) {
            const name = change.name.trim()
            if (name.length === 0 || name.length > NAME_MAX)
                throw new WorkspacesError({ code: WorkspacesErrorCode.NameInvalid })
            columns.name = name
        }
        if (change.timeZone !== undefined) {
            if (!isKnownTimeZone(change.timeZone))
                throw new WorkspacesError({ code: WorkspacesErrorCode.TimeZoneInvalid })
            columns.timeZone = change.timeZone
        }
        if (change.logoUrl !== undefined) columns.logoUrl = change.logoUrl
        return columns
    }
}
