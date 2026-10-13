import { Field, ObjectType, Int } from "@nestjs/graphql"
import { LeadGenOriginType } from "./leadgen-origin.type"

@ObjectType()
/** LeadGenSource exposed to the workbench. */
export class LeadGenSourceType {
    /** Stable source grouping identity. */
    @Field(() => String)
    key!: string

    /** Attributed source. */
    @Field(() => LeadGenOriginType)
    origin!: LeadGenOriginType

    /** Prospects from this source. */
    @Field(() => Int)
    leads!: number

    /** Hot prospects from this source. */
    @Field(() => Int)
    hot!: number

    /** Won prospects from this source. */
    @Field(() => Int)
    won!: number
}
