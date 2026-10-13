import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The workspace a person joined by accepting an invitation. */
export class AcceptInviteType {
    /** The workspace the person joined. */
    @Field(() => ID)
    workspaceId!: string
}
