import { Field, Float, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One SePay transfer matched to an order of the workspace. */
export class AdminTransferType {
    /** The sepay id. */
    @Field(() => Float)
    sepayId!: number

    /** The transfer amount. */
    @Field(() => Float, { nullable: true })
    transferAmount!: number | null

    /** The content. */
    @Field(() => String, { nullable: true })
    content!: string | null

    /** The status. */
    @Field()
    status!: string

    /** The received at. */
    @Field()
    receivedAt!: string
}
