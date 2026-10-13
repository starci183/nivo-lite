import { Field, Float, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One typed value from a proposal's dynamic field map. */
export class LeadFlowProposalFieldType {
    /** The original key in the proposal field map. */
    @Field()
    key!: string

    /** The value kind: string, number or null. */
    @Field()
    kind!: string

    /** The value when its kind is string. */
    @Field(() => String, { nullable: true })
    stringValue!: string | null

    /** The value when its kind is number. */
    @Field(() => Float, { nullable: true })
    numberValue!: number | null
}
