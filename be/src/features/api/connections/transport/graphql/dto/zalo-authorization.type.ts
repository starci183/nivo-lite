import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The Zalo permission page to open. */
export class ZaloAuthorizationType {
    /** The Zalo permission page. */
    @Field(() => String)
    url!: string

    /** The address Zalo returns the browser to. */
    @Field(() => String)
    callbackUrl!: string
}
