import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One workspace as a member sees it. */
export class WorkspaceType {
    /** The workspace id. */
    @Field(() => ID)
    id!: string

    /** The workspace name. */
    @Field()
    name!: string

    /** `active`, `pending_payment` or `cancelled`. */
    @Field()
    status!: string

    /** The Auth user who owns it. */
    @Field(() => ID)
    ownerId!: string

    /** When it was created, ISO 8601. */
    @Field()
    createdAt!: string

    /** The business type chosen at onboarding. */
    @Field(() => String, { nullable: true })
    businessType!: string | null
}
