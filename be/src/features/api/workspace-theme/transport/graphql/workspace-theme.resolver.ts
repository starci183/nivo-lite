import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { Args, Mutation, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import { ReadWorkspaceThemeQuery } from "../../application/read-workspace-theme.query"
import { ResetWorkspaceThemeCommand } from "../../application/reset-workspace-theme.command"
import { UpdateWorkspaceThemeCommand } from "../../application/update-workspace-theme.command"
import { UpdateWorkspaceThemeInput } from "./dto/update-workspace-theme.input"
import { WorkspaceThemeType } from "./dto/workspace-theme.type"
import { toUpdateWorkspaceThemeRequest, toWorkspaceThemeType } from "./workspace-theme.mapper"

@Resolver()
/** GraphQL door of the workspace's brand theme: read, save, return to the NIVO default. */
export class WorkspaceThemeResolver {
    constructor(
        @InjectQueryBus() private readonly queryBus: QueryBus,
        @InjectCommandBus() private readonly commandBus: CommandBus,
    ) {}

    /** The theme of the workspace named by X-Workspace-Id; any member reads it; null wears the NIVO default. */
    @Query(() => WorkspaceThemeType, { name: "workspaceTheme", nullable: true })
    async workspaceTheme(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<WorkspaceThemeType | null> {
        const theme = await this.queryBus.execute(new ReadWorkspaceThemeQuery({ request: { workspaceId }, principal }))
        return toWorkspaceThemeType(theme)
    }

    /** Saves the theme; the owner or a manager only. Every member is checked by range or list. */
    @Mutation(() => WorkspaceThemeType, { name: "updateWorkspaceTheme", nullable: true })
    async updateWorkspaceTheme(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: UpdateWorkspaceThemeInput,
    ): Promise<WorkspaceThemeType | null> {
        const theme = await this.commandBus.execute(
            new UpdateWorkspaceThemeCommand({ request: toUpdateWorkspaceThemeRequest(workspaceId, input), principal }),
        )
        return toWorkspaceThemeType(theme)
    }

    /** Returns the workspace to the NIVO default theme; the owner or a manager only. */
    @Mutation(() => Boolean, { name: "resetWorkspaceTheme" })
    resetWorkspaceTheme(@CurrentPrincipal() principal: Principal, @WorkspaceId() workspaceId: string): Promise<boolean> {
        return this.commandBus.execute(new ResetWorkspaceThemeCommand({ request: { workspaceId }, principal }))
    }
}
