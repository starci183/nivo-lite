import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One line of a candidate's timeline. */
export class HiringEventType {
    /** The event id. */
    @Field(() => ID)
    id!: string

    /** The event kind. */
    @Field(() => String)
    kind!: string

    /** Who did it. */
    @Field(() => String)
    actor!: string

    /** One line saying what happened. */
    @Field(() => String)
    summary!: string

    /** When it happened. */
    @Field(() => String)
    createdAt!: string
}
