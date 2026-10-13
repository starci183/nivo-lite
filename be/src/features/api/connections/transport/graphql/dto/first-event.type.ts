import { Field, Float, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The first event a connection accepted. */
export class FirstEventType {
    /** The amount of the event. */
    @Field(() => Float)
    amount!: number

    /** The content of the event. */
    @Field(() => String)
    content!: string

    /** When it arrived, ISO 8601. */
    @Field(() => String)
    at!: string

    /** An optional readable line. */
    @Field(() => String, { nullable: true })
    text?: string
}
