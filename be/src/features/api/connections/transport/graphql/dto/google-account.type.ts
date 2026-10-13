import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One Google account a workspace connected. */
export class GoogleAccountType {
    /** The connection id. */
    @Field(() => ID)
    id!: string

    /** The account email, blank when Google never said. */
    @Field(() => String)
    email!: string

    /** The connection status. */
    @Field(() => String)
    status!: string
}
