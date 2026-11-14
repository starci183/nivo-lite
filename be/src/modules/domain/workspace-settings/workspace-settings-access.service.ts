import { Injectable } from "@nestjs/common"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type {
    WorkspaceLogoFile,
    WorkspaceLogos,
    WorkspaceLogoUpload,
    WorkspaceSettings,
    WorkspaceSettingsRequestedEdit,
} from "./workspace-settings.contracts"
import { InjectWorkspaceLogos } from "./workspace-settings.decorators"
import { WorkspaceSettingsService } from "./workspace-settings.service"

const MANAGERS = ["owner", "manager"] as const

@Injectable()
/**
 * The door a person reaches the workspace settings through: any member reads them, an owner or a manager changes them (name, time
 * zone, logo). The logo is a picture in the core's public picture store: an upload address is issued first, then the change names the path
 * the upload used and only the address the storage gives for that path is kept.
 */
export class WorkspaceSettingsAccessService {
    constructor(
        private readonly settings: WorkspaceSettingsService,
        private readonly members: WorkspaceMembersService,
        @InjectWorkspaceLogos() private readonly logos: WorkspaceLogos,
    ) {}

    /** The settings of the workspace, for any of its members. */
    async read(userId: string, workspaceId: string): Promise<WorkspaceSettings> {
        await this.members.require(userId, workspaceId)
        return this.settings.get(workspaceId)
    }

    /** Saves the name, time zone or logo the edit carries and answers the settings as they are now; an owner or a manager only. */
    async change(userId: string, workspaceId: string, edit: WorkspaceSettingsRequestedEdit): Promise<WorkspaceSettings> {
        await this.members.require(userId, workspaceId, MANAGERS)
        const logoUrl =
            typeof edit.logoPath === "string" ? this.logos.workspaceLogoAddressOf(edit.logoPath) : edit.logoPath
        return this.settings.update(workspaceId, {
            ...(edit.name == null ? {} : { name: edit.name }),
            ...(edit.timeZone == null ? {} : { timeZone: edit.timeZone }),
            ...(logoUrl === undefined ? {} : { logoUrl }),
        })
    }

    /** A one-time address to upload the logo to (PNG, JPEG or WebP, at most 2 MB); an owner or a manager only. */
    requestLogoUpload(userId: string, workspaceId: string, file: WorkspaceLogoFile): Promise<WorkspaceLogoUpload> {
        return this.logos.requestWorkspaceUpload(userId, workspaceId, file)
    }
}
