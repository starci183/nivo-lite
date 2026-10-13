import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What starting the Meta login answers. */
export class MetaAuthorizationType {
    /** The connection the login belongs to. */
    @Field(() => ID)
    connectionId!: string

    /** The Meta login url. */
    @Field(() => String)
    url!: string
}
