import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A saved publication mark and whether every channel is complete. */
export class MarkContentPublishedType {
    /** The content item. */
    @Field(() => ID)
    id!: string

    /** True when every selected channel was marked published. */
    @Field()
    allDone!: boolean
}
