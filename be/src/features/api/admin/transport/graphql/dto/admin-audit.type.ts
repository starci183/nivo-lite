import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One line of the console audit trail. */
export class AdminAuditType {
    /** The id. */
    @Field(() => ID)
    id!: string

    /** The actor email. */
    @Field()
    actorEmail!: string

    /** The action. */
    @Field()
    action!: string

    /** The workspace id. */
    @Field(() => ID, { nullable: true })
    workspaceId!: string | null

    /** The created at. */
    @Field()
    createdAt!: string
}
