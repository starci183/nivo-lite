import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The identity of the affected post. */
export class ContentItemIdType {
    /** The affected post. */
    @Field(() => ID)
    id!: string
}
