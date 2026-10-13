import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Who the signed-in platform admin is. */
export class AdminSessionType {
    /** The email. */
    @Field()
    email!: string
}
