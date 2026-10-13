import { Field, Float, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One SePay transfer of the platform. */
export class AdminPlatformTransferType {
    /** The status. */
    @Field()
    status!: string

    /** The transfer amount. */
    @Field(() => Float, { nullable: true })
    transferAmount!: number | null

    /** The content. */
    @Field(() => String, { nullable: true })
    content!: string | null

    /** The received at. */
    @Field()
    receivedAt!: string
}
