import { Field, ObjectType } from "@nestjs/graphql"
import { MemberType } from "./member.type"
import { MembershipLobbyType } from "./membership-lobby.type"
import { WorkspaceType } from "./workspace.type"

@ObjectType()
/** A workspace with the caller membership in it. */
export class MembershipType {
    /** The workspace. */
    @Field(() => WorkspaceType)
    workspace!: WorkspaceType

    /** The membership of the caller. */
    @Field(() => MemberType)
    member!: MemberType

    /** What the workspaces lobby shows beside it. */
    @Field(() => MembershipLobbyType)
    lobby!: MembershipLobbyType
}
