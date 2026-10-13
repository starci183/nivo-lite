import { Field, ObjectType } from "@nestjs/graphql"
import { MemberType } from "./member.type"
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
}
