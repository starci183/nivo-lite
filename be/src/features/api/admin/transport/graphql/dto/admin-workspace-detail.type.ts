import { Field, Int, ObjectType } from "@nestjs/graphql"
import { AdminWorkspaceHeaderType } from "./admin-workspace-header.type"
import { AdminCreditsType } from "./admin-credits.type"
import { AdminMemberType } from "./admin-member.type"
import { AdminInviteType } from "./admin-invite.type"
import { AdminOrderType } from "./admin-order.type"
import { AdminTransferType } from "./admin-transfer.type"
import { AdminBillingEventType } from "./admin-billing-event.type"
import { AdminModuleType } from "./admin-module.type"
import { AdminConnectionType } from "./admin-connection.type"
import { AdminErrorType } from "./admin-error.type"
import { AdminKnowledgeKindType } from "./admin-knowledge-kind.type"
import { AdminActivityType } from "./admin-activity.type"

@ObjectType()
/** The full read-only overview of one workspace. */
export class AdminWorkspaceDetailType {
    /** The workspace. */
    @Field(() => AdminWorkspaceHeaderType)
    workspace!: AdminWorkspaceHeaderType

    /** The credits. */
    @Field(() => AdminCreditsType)
    credits!: AdminCreditsType

    /** The members. */
    @Field(() => [AdminMemberType])
    members!: Array<AdminMemberType>

    /** The invites. */
    @Field(() => [AdminInviteType])
    invites!: Array<AdminInviteType>

    /** The orders. */
    @Field(() => [AdminOrderType])
    orders!: Array<AdminOrderType>

    /** The transfers. */
    @Field(() => [AdminTransferType])
    transfers!: Array<AdminTransferType>

    /** The billing events. */
    @Field(() => [AdminBillingEventType])
    billingEvents!: Array<AdminBillingEventType>

    /** The modules. */
    @Field(() => [AdminModuleType])
    modules!: Array<AdminModuleType>

    /** The connections. */
    @Field(() => [AdminConnectionType])
    connections!: Array<AdminConnectionType>

    /** The errors. */
    @Field(() => [AdminErrorType])
    errors!: Array<AdminErrorType>

    /** The knowledge total. */
    @Field(() => Int)
    knowledgeTotal!: number

    /** The knowledge. */
    @Field(() => [AdminKnowledgeKindType])
    knowledge!: Array<AdminKnowledgeKindType>

    /** The activity. */
    @Field(() => AdminActivityType)
    activity!: AdminActivityType
}
