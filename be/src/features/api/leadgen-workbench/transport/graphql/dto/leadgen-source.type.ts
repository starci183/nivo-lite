import { Field, Int, ObjectType } from "@nestjs/graphql"
import { LeadGenOriginType } from "./leadgen-origin.type"

@ObjectType()
/** One source with its prospect and conversion counts. */
export class LeadGenSourceType {
    /** The stable source key. */
    @Field(() => String)
    key!: string
    /** The source reference. */
    @Field(() => LeadGenOriginType)
    origin!: LeadGenOriginType
    /** The number of prospects. */
    @Field(() => Int)
    leads!: number
    /** The number scored hot. */
    @Field(() => Int)
    hot!: number
    /** The number of won prospects. */
    @Field(() => Int)
    won!: number
}
