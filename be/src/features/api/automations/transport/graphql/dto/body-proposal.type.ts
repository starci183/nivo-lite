import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A proposal for the wording of a message. */
export class BodyProposalType {
    /** The proposed template. */
    @Field()
    body!: string

    /** False when the standard wording is returned because the model could not write one. */
    @Field(() => Boolean)
    generated!: boolean

    /** The context version the proposal is written from. */
    @Field(() => Int, { nullable: true })
    contextVersion!: number | null
}
