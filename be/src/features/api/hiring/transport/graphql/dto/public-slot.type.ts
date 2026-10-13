import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One offered time. */
export class PublicSlotType {
    /** The start, ISO. */
    @Field(() => String)
    start!: string

    /** The end, ISO. */
    @Field(() => String)
    end!: string
}
