import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** LeadGenOrigin exposed to the workbench. */
export class LeadGenOriginType {
    /** The source network. */
    @Field(() => String)
    platform!: string

    /** How this prospect arrived. */
    @Field(() => String)
    kind!: string

    /** Post, ad or form reference kind. */
    @Field(() => String, { nullable: true })
    refKind!: string | null

    /** The source reference. */
    @Field(() => String, { nullable: true })
    refId!: string | null

    /** A readable source label. */
    @Field(() => String, { nullable: true })
    refLabel!: string | null
}
