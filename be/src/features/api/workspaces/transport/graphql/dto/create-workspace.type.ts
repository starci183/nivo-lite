import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The workspace a caller just created. */
export class CreateWorkspaceType {
    /** The id of the new workspace. */
    @Field(() => ID)
    id!: string
}
