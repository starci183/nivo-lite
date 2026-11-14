import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { Args, Mutation, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import { ReadWorkspaceSettingsQuery } from "../../application/read-workspace-settings.query"
import { RequestWorkspaceLogoUploadCommand } from "../../application/request-workspace-logo-upload.command"
import { UpdateWorkspaceSettingsCommand } from "../../application/update-workspace-settings.command"
import { RequestWorkspaceLogoUploadInput } from "./dto/request-workspace-logo-upload.input"
import { UpdateWorkspaceSettingsInput } from "./dto/update-workspace-settings.input"
import { WorkspaceLogoUploadType } from "./dto/workspace-logo-upload.type"
import { WorkspaceSettingsType } from "./dto/workspace-settings.type"
import {
    toRequestWorkspaceLogoUploadRequest,
    toUpdateWorkspaceSettingsRequest,
    toWorkspaceLogoUploadType,
    toWorkspaceSettingsType,
} from "./workspace-settings.mapper"

@Resolver()
/** GraphQL door of the workspace's own settings: its name, time zone and logo. */
export class WorkspaceSettingsResolver {
    constructor(
        @InjectQueryBus() private readonly queryBus: QueryBus,
        @InjectCommandBus() private readonly commandBus: CommandBus,
    ) {}

    /** The name, time zone and logo of the workspace named by X-Workspace-Id; any member reads them. */
    @Query(() => WorkspaceSettingsType, { name: "workspaceSettings" })
    async workspaceSettings(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<WorkspaceSettingsType> {
        const settings = await this.queryBus.execute(
            new ReadWorkspaceSettingsQuery({ request: { workspaceId }, principal }),
        )
        return toWorkspaceSettingsType(settings)
    }

    /** Changes the name, time zone or logo; the owner or a manager only. A member the input leaves out stays as it is. */
    @Mutation(() => WorkspaceSettingsType, { name: "updateWorkspaceSettings" })
    async updateWorkspaceSettings(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: UpdateWorkspaceSettingsInput,
    ): Promise<WorkspaceSettingsType> {
        const settings = await this.commandBus.execute(
            new UpdateWorkspaceSettingsCommand({
                request: toUpdateWorkspaceSettingsRequest(workspaceId, input),
                principal,
            }),
        )
        return toWorkspaceSettingsType(settings)
    }

    /** A one-time address the browser PUTs the logo to (PNG, JPEG or WebP, at most 2 MB); the owner or a manager only. */
    @Mutation(() => WorkspaceLogoUploadType, { name: "requestWorkspaceLogoUpload" })
    async requestWorkspaceLogoUpload(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RequestWorkspaceLogoUploadInput,
    ): Promise<WorkspaceLogoUploadType> {
        const upload = await this.commandBus.execute(
            new RequestWorkspaceLogoUploadCommand({
                request: toRequestWorkspaceLogoUploadRequest(workspaceId, input),
                principal,
            }),
        )
        return toWorkspaceLogoUploadType(upload)
    }
}
