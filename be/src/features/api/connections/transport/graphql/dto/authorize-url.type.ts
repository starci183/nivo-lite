import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A provider consent page to open. */
export class AuthorizeUrlType {
    /** The address the browser must go to. */
    @Field(() => String)
    url!: string
}
