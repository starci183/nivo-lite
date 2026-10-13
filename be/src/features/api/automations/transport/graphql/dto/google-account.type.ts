import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A Google account a spreadsheet automation can write with. */
export class GoogleAccountType {
    /** The connection id. */
    @Field(() => ID)
    id!: string

    /** The email of the account. */
    @Field()
    email!: string

    /** The state of the connection. */
    @Field()
    status!: string
}
