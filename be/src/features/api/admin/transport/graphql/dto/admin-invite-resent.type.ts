import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What resending an invitation answers. */
export class AdminInviteResentType {
    /** The email. */
    @Field()
    email!: string

    /** The delivery. */
    @Field()
    delivery!: string
}
