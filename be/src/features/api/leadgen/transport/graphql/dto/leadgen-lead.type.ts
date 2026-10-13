import { Field, ObjectType, ID } from "@nestjs/graphql"
import { LeadGenOriginType } from "./leadgen-origin.type"

@ObjectType()
/** LeadGenLead exposed to the workbench. */
export class LeadGenLeadType {
    /** The prospect. */
    @Field(() => ID)
    id!: string

    /** Customer display name. */
    @Field(() => String)
    name!: string

    /** Current sales stage. */
    @Field(() => String)
    stage!: string

    /** Hot, warm or cold when scored. */
    @Field(() => String, { nullable: true })
    score!: string | null

    /** Attributed source. */
    @Field(() => LeadGenOriginType)
    origin!: LeadGenOriginType

    /** The latest message or captured need. */
    @Field(() => String)
    lastText!: string

    /** Latest activity instant. */
    @Field(() => String)
    lastAt!: string

    /** Capture instant. */
    @Field(() => String)
    createdAt!: string

    /** The prospect detail path. */
    @Field(() => String)
    href!: string
}
