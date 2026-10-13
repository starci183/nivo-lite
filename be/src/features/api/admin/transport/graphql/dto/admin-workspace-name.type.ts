import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The name of a workspace the health page links to. */
export class AdminWorkspaceNameType {
    /** The id. */
    @Field(() => ID)
    id!: string

    /** The name. */
    @Field()
    name!: string
}
