import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One document pinned in a Hub room. */
export class OfficeRoomPinType {
    /** The pin id. */
    @Field(() => ID)
    id!: string

    /** The document title. */
    @Field()
    title!: string

    /** Where it opens, when it does. */
    @Field(() => String, { nullable: true })
    href?: string | null

    /** The line under it. */
    @Field()
    note!: string
}
