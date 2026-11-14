import { Injectable } from "@nestjs/common"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceTheme, WorkspaceThemeRequest } from "./workspace-settings.contracts"
import { WorkspaceSettingsService } from "./workspace-settings.service"

const MANAGERS = ["owner", "manager"] as const

@Injectable()
/**
 * The door a person reaches the workspace theme through: any member reads it, an owner or a manager saves it or returns it to the NIVO
 * default. It needs the members capability and the settings service only (no logo store), so the api and the mcp app both register it.
 */
export class WorkspaceThemeAccessService {
    constructor(
        private readonly settings: WorkspaceSettingsService,
        private readonly members: WorkspaceMembersService,
    ) {}

    /** The theme of the workspace (null: the NIVO default), for any of its members. */
    async readTheme(userId: string, workspaceId: string): Promise<WorkspaceTheme | null> {
        await this.members.require(userId, workspaceId)
        return this.settings.getTheme(workspaceId)
    }

    /** Saves the theme, or returns to the NIVO default when given null; an owner or a manager only. */
    async changeTheme(userId: string, workspaceId: string, theme: unknown): Promise<WorkspaceTheme | null> {
        await this.members.require(userId, workspaceId, MANAGERS)
        return this.settings.setTheme(workspaceId, theme)
    }

    /** Saves the theme the request carries (its `workspaceId` names the workspace, every other member is the theme); an owner or a manager only. */
    updateTheme(userId: string, request: WorkspaceThemeRequest): Promise<WorkspaceTheme | null> {
        const { workspaceId, ...theme } = request
        return this.changeTheme(userId, workspaceId, theme)
    }

    /** Returns the workspace to the NIVO default theme; an owner or a manager only. Answers true once it is done. */
    async resetTheme(userId: string, workspaceId: string): Promise<boolean> {
        await this.changeTheme(userId, workspaceId, null)
        return true
    }
}
