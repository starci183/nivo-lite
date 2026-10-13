import { Field, ObjectType } from "@nestjs/graphql"
import { LeadGenOriginType } from "./leadgen-origin.type"

@ObjectType()
/** One prospect with its source, score and latest conversation. */
export class LeadGenLeadType {
    /** The lead id. */
    @Field(() => String)
    id!: string
    /** The customer name. */
    @Field(() => String)
    name!: string
    /** The journey stage. */
    @Field(() => String)
    stage!: string
    /** The lead's temperature, when scored. */
    @Field(() => String, { nullable: true })
    score!: string | null
    /** The source attribution. */
    @Field(() => LeadGenOriginType)
    origin!: LeadGenOriginType
    /** The latest message summary. */
    @Field(() => String)
    lastText!: string
    /** The latest conversation time. */
    @Field(() => String)
    lastAt!: string
    /** The lead creation time. */
    @Field(() => String)
    createdAt!: string
    /** The lead journey path. */
    @Field(() => String)
    href!: string
}
