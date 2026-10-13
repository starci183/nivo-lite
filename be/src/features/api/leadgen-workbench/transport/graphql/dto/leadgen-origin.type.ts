import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The platform and source reference from which a prospect arrived. */
export class LeadGenOriginType {
    /** Facebook, Instagram or another network. */
    @Field(() => String)
    platform!: string
    /** Lead ad, direct message, comment, mention or another source. */
    @Field(() => String)
    kind!: string
    /** The attributed reference kind. */
    @Field(() => String, { nullable: true })
    refKind!: string | null
    /** The platform's source identifier. */
    @Field(() => String, { nullable: true })
    refId!: string | null
    /** The readable source name, when captured. */
    @Field(() => String, { nullable: true })
    refLabel!: string | null
}
