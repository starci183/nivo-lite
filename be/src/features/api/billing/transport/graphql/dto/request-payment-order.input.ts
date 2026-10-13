import { Field, InputType } from "@nestjs/graphql"
import { IsIn, IsOptional, IsString, Matches, MaxLength } from "class-validator"
import type { PaymentOrderRequestKind } from "@modules/domain/payment-order-requests"

@InputType()
/** The bounded operation and target of a queued payment order. */
export class RequestPaymentOrderInput {
    /** The supported payment operation. */
    @Field(() => String)
    @IsString()
    @IsIn(["plan", "renew", "topup", "upgrade"])
    kind!: PaymentOrderRequestKind

    /** An active plan or pack code; renewal does not need a target. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(40)
    @Matches(/^[a-z0-9_-]{1,40}$/)
    target?: string | null
}
