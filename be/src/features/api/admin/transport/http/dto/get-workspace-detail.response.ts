import type {
    AdminActivity,
    AdminBillingEvent,
    AdminConnection,
    AdminCredits,
    AdminError,
    AdminInvite,
    AdminKnowledgeKind,
    AdminMember,
    AdminModule,
    AdminOrder,
    AdminTransfer,
    AdminWorkspaceHeader,
} from "@modules/domain/platform-admin"

/** The HTTP response of getWorkspaceDetail. */
export class GetWorkspaceDetailResponse {
    /** The header facts. */
    workspace!: AdminWorkspaceHeader

    /** The month's AI credits. */
    credits!: AdminCredits

    /** The members. */
    members!: ReadonlyArray<AdminMember>

    /** The pending invitations. */
    invites!: ReadonlyArray<AdminInvite>

    /** The newest payment orders. */
    orders!: ReadonlyArray<AdminOrder>

    /** The SePay transfers matched to the orders. */
    transfers!: ReadonlyArray<AdminTransfer>

    /** The newest billing events. */
    billingEvents!: ReadonlyArray<AdminBillingEvent>

    /** The agent installations. */
    modules!: ReadonlyArray<AdminModule>

    /** The connections. */
    connections!: ReadonlyArray<AdminConnection>

    /** The newest captured errors. */
    errors!: ReadonlyArray<AdminError>

    /** How many knowledge sources the workspace has. */
    knowledgeTotal!: number

    /** The knowledge sources by kind and status. */
    knowledge!: ReadonlyArray<AdminKnowledgeKind>

    /** The activity block. */
    activity!: AdminActivity
}
