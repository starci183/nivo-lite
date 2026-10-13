import { Field, ObjectType } from "@nestjs/graphql"
import { ReconcileCandidateType } from "./reconcile-candidate.type"
import { ReconcilePaymentType } from "./reconcile-payment.type"

@ObjectType()
/** What the owner checks before matching a payment to an invoice. */
export class ReconcileDetailsType {
    /** The payment or the claim. */
    @Field(() => ReconcilePaymentType)
    payment!: ReconcilePaymentType

    /** The invoices NIVO proposes, in the proposal's order. */
    @Field(() => [ReconcileCandidateType])
    candidates!: ReadonlyArray<ReconcileCandidateType>
}
