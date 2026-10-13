import { Field, ObjectType, Int } from "@nestjs/graphql"

@ObjectType()
/** Lead conversion within one source channel. */
export class SalesSourceConversionType {
    /** The source. */
    @Field(() => String)
    source!: string

    /** The leads. */
    @Field(() => Int)
    leads!: number

    /** The won. */
    @Field(() => Int)
    won!: number
}
