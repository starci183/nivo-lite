import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Where the Google Drive read grant of a workspace stands. */
export class DriveGrantType {
    /** `none`, `connected` or `lost`. */
    @Field(() => String)
    state!: string

    /** The Google account that gave the grant, blank when none. */
    @Field(() => String)
    email!: string
}
