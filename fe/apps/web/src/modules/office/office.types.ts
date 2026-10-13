/** Who wrote a line. */
export type OfficeAuthorKind = "human" | "agent" | "system"

/** One line of the Office thread. */
export interface OfficeMessage {
    readonly id: string
    readonly authorKind: OfficeAuthorKind
    readonly authorName: string
    readonly body: string
    readonly createdAt: string
    readonly agentId: string | null
    readonly leadId: string | null
    readonly workItemId: string | null
}

/** One approval request (an execution waiting for, or already given, a decision). */
export interface OfficeApproval {
    readonly id: string
    readonly status: "pending_approval" | "approved" | "rejected"
    readonly draft: string
    readonly createdAt: string
    readonly decidedAt: string | null
    readonly decidedBy: string | null
    readonly agentId: string | null
    readonly agentName: string | null
    readonly assignedStaffId: string | null
    readonly channel: string
    readonly leadId: string | null
    readonly leadName: string | null
    readonly nextAction: string
}

/** The confirm card of an owner's command message. */
export interface OfficeCandidate {
    readonly id: string
    readonly messageId: string
    readonly module: string
    readonly command: string
    readonly summary: string
    readonly status: "pending" | "sent" | "cancelled"
    readonly refusal: string | null
    readonly workItemId: string | null
    readonly shown: ReadonlyArray<{ readonly key: string; readonly label: string; readonly value: string }>
}

/** One work item as the exception cards use it. */
export interface OfficeWork {
    readonly id: string
    readonly action: string
    readonly department: string
    readonly status: string
    readonly reason: string | null
    readonly error: string | null
    readonly origin: string
    readonly createdAt: string
    readonly updatedAt: string
    readonly completedAt: string | null
    readonly assignedStaffId: string | null
    readonly leadId: string | null
    readonly executionId: string | null
    readonly decidedPath: string | null
    readonly missingFields: ReadonlyArray<string>
    readonly summary: string
    readonly draft: string | null
    readonly amountVnd: number | null
    readonly candidates: ReadonlyArray<{ readonly id: string; readonly label: string; readonly amountVnd: number }>
    readonly fields: unknown
    readonly resultSummary: string | null
}

/** An installed agent. */
export interface OfficeAgent {
    readonly id: string
    readonly module: string
    readonly name: string
    readonly handle: string
    readonly isActive: boolean
}

/** One account of the workspace. */
export interface OfficePerson {
    readonly userId: string
    readonly name: string
    readonly role: "owner" | "manager" | "staff"
    readonly staffId: string | null
    readonly lastSeen: string | null
}

/** One staff row of the workspace. */
export interface OfficeStaff {
    readonly id: string
    readonly name: string
    readonly role: string
}

/** One lead of the board, as the customer list and the lead chips use it. */
export interface OfficeLead {
    readonly id: string
    readonly name: string
    readonly preview: string | null
    readonly createdAt: string
}

/** One team task. */
export interface OfficeTask {
    readonly id: string
    readonly leadId: string
    readonly title: string
    readonly status: "open" | "waiting_approval" | "done"
    readonly nextAction: string
    readonly ownerName: string
    readonly leadName: string
    readonly dueAt: string | null
}
