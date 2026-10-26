import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { Args, Mutation, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import { ListConversationUnreadQuery } from "../../application/list-conversation-unread.query"
import { ListOfficeRoomsQuery } from "../../application/list-office-rooms.query"
import { MarkConversationReadCommand } from "../../application/mark-conversation-read.command"
import { MarkRoomReadCommand } from "../../application/mark-room-read.command"
import { SetupOfficeRoomsCommand } from "../../application/setup-office-rooms.command"
import { OfficeAckType } from "./dto/office-ack.type"
import { OfficeConversationReadInput } from "./dto/office-conversation-read.input"
import { OfficeRoomKeyInput } from "./dto/office-room-key.input"
import { OfficeRoomType } from "./dto/office-room.type"
import { OfficeConversationUnreadType } from "./dto/office-unread.type"
import {
    toConversationUnreadType,
    toMarkConversationReadRequest,
    toMarkRoomReadRequest,
    toOfficeAckType,
    toOfficeRoomsType,
    toWorkspaceRequest,
} from "./office.mapper"

@Resolver()
/** GraphQL doors of the Hub rooms: the list with unread counts, the read marker and the room setup. */
export class OfficeRoomsResolver {
    constructor(
        @InjectQueryBus() private readonly queryBus: QueryBus,
        @InjectCommandBus() private readonly commandBus: CommandBus,
    ) {}

    /** Lists the Office room and the department rooms with the caller's unread counts. */
    @Query(() => [OfficeRoomType], { name: "officeRooms" })
    async officeRooms(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<Array<OfficeRoomType>> {
        const result = await this.queryBus.execute(
            new ListOfficeRoomsQuery({ request: toWorkspaceRequest(workspaceId), principal }),
        )
        return toOfficeRoomsType(result)
    }

    /** The caller's direct conversations: every agent with its unread count and newest line, and the unread customer ones. */
    @Query(() => OfficeConversationUnreadType, { name: "officeConversationUnread" })
    async officeConversationUnread(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<OfficeConversationUnreadType> {
        const result = await this.queryBus.execute(
            new ListConversationUnreadQuery({ request: toWorkspaceRequest(workspaceId), principal }),
        )
        return toConversationUnreadType(result)
    }

    /** Marks a room read by the caller up to now. */
    @Mutation(() => OfficeAckType, { name: "markOfficeRoomRead" })
    async markOfficeRoomRead(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: OfficeRoomKeyInput,
    ): Promise<OfficeAckType> {
        await this.commandBus.execute(
            new MarkRoomReadCommand({ request: toMarkRoomReadRequest(workspaceId, input), principal }),
        )
        return toOfficeAckType()
    }

    /** Marks a direct conversation (one agent's or one customer's lines) read by the caller up to now. */
    @Mutation(() => OfficeAckType, { name: "markOfficeConversationRead" })
    async markOfficeConversationRead(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: OfficeConversationReadInput,
    ): Promise<OfficeAckType> {
        await this.commandBus.execute(
            new MarkConversationReadCommand({
                request: toMarkConversationReadRequest(workspaceId, input),
                principal,
            }),
        )
        return toOfficeAckType()
    }

    /** Opens the six department rooms of the workspace (owner or manager) and answers the rooms. */
    @Mutation(() => [OfficeRoomType], { name: "setupOfficeRooms" })
    async setupOfficeRooms(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
    ): Promise<Array<OfficeRoomType>> {
        const result = await this.commandBus.execute(
            new SetupOfficeRoomsCommand({ request: { workspaceId, locale }, principal }),
        )
        return toOfficeRoomsType(result)
    }
}
