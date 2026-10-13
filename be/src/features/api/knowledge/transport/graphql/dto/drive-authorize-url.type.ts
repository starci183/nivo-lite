import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The Google consent page of the Drive read grant. */
export class DriveAuthorizeUrlType {
    /** The address the browser must go to. */
    @Field(() => String)
    url!: string
}
