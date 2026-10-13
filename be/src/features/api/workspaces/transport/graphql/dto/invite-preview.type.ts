import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What an invitation link offers before it is accepted. */
export class InvitePreviewType {
    /** The workspace they are invited to. */
    @Field()
    workspaceName!: string

    /** The invited address. */
    @Field()
    email!: string

    /** The role it grants. */
    @Field()
    role!: string

    /** The staff member it links, when any. */
    @Field(() => String, { nullable: true })
    staffName!: string | null

    /** `pending`, `revoked`, `accepted` or `expired`. */
    @Field()
    state!: string
}
