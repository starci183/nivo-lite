import { Field, ObjectType, ID } from "@nestjs/graphql"

@ObjectType()
/** A staff or customer choice offered by the workbench. */
export class SalesChoiceType {
    /** The id. */
    @Field(() => ID)
    id!: string

    /** The name. */
    @Field(() => String)
    name!: string
}
