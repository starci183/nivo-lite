import { Field, ObjectType, ID } from "@nestjs/graphql"

@ObjectType()
/** The caller's identity and permissions in the selected workspace. */
export class ContentActorType {
    /** The workspace being edited. */
    @Field(() => ID)
    workspaceId!: string

    /** The member name used in the post history. */
    @Field()
    name!: string

    /** Whether the caller may manage content. */
    @Field()
    canManage!: boolean
}
