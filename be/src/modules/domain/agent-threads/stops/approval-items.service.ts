import { Injectable, Optional } from "@nestjs/common"
import { WorkItemsService, type Proposal, type SubjectType, type WorkItem } from "@modules/domain/work-items"
import { InjectMessageCatalog, type Locale, type MessageCatalog } from "@modules/platform/i18n"

/** Why the owner's item of an approval waits: the engine asks a person, always (a node on `ask`). */
const ASKED = "branch_ask"

/** The proposal field that keeps who approved the call: the decider the engine reads back on a later run of the step. */
export const APPROVED_BY_FIELD = "approvedBy"

/** The proposal field that keeps why an item closed without its own verdict (a code, never prose): `withdrawn:<why>`, a take-over. */
export const CLOSED_AS_FIELD = "closedAs"

/** The owner's item of one approval as the engine raises it. */
export interface ApprovalItemRaise {
    /** The workspace. */
    readonly workspaceId: string
    /** The module the item is filed under (the agent's installation). */
    readonly department: string
    /** The action key of the item. */
    readonly action: string
    /** What the item is about: the customer, else the conversation. */
    readonly subjectType: SubjectType
    /** The record it is about. */
    readonly subjectId: string | null
    /** The customer, when the run names one. */
    readonly leadId: string | null
    /** Once per run, step and exact call. */
    readonly dedupeKey: string
    /** The summary and the fields of the call. */
    readonly proposal: Proposal
}

/** An item a verdict closes: the item, taken from `waiting_decision` by this verdict alone. */
export type ApprovalItemTaken = WorkItem

@Injectable()
/**
 * The owner's items of the approvals of thread runs, kept in the work items store (the Office reads them there): raised once per key,
 * waiting for a person, and closed by exactly one verdict. Each close first TAKES the item out of `waiting_decision` (a guarded
 * transition), so two verdicts, or a verdict and a withdrawal, never both close it. No work engine: the stop of the step is the
 * approval, the item is its record. An app without the work items store keeps no item (every call answers null or false).
 */
export class ApprovalItemsService {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @Optional() private readonly items?: WorkItemsService,
    ) {}

    /** Raises the item waiting for a person, once per key: a repeat answers the item the key already stands for. Null with no store. */
    async raise(raise: ApprovalItemRaise): Promise<WorkItem | null> {
        if (this.items === undefined) return null
        const inserted = await this.items.insert({
            workspaceId: raise.workspaceId,
            chainId: null,
            depth: 0,
            department: raise.department,
            action: raise.action,
            subjectType: raise.subjectType,
            subjectId: raise.subjectId,
            leadId: raise.leadId,
            inboundEventId: null,
            parentId: null,
            dedupeKey: raise.dedupeKey,
            proposal: raise.proposal,
            installationId: null,
        })
        if (inserted === null) return this.items.findByDedupe(raise.workspaceId, raise.dedupeKey)
        return this.items.markWaiting(inserted.id, {
            reason: ASKED,
            reasons: [ASKED],
            missing: [],
            proposal: inserted.proposal,
            executionId: null,
        })
    }

    /** The item an approval stop names, in this workspace, or null. */
    async find(workspaceId: string, workItemId: string): Promise<WorkItem | null> {
        const [item] = (await this.items?.findMany([workItemId], 1)) ?? []
        return item?.workspace_id === workspaceId ? item : null
    }

    /** The item a key stands for, or null. */
    byKey(workspaceId: string, dedupeKey: string): Promise<WorkItem | null> {
        return this.items?.findByDedupe(workspaceId, dedupeKey) ?? Promise.resolve(null)
    }

    /** The newest item of an action whose key is `baseKey` or one of its `baseKey:<suffix>` repeats, or null. */
    latestOfKey(workspaceId: string, action: string, baseKey: string): Promise<WorkItem | null> {
        return this.items?.latestOfKey(workspaceId, action, baseKey) ?? Promise.resolve(null)
    }

    /** Takes the item out of `waiting_decision` for one verdict; null when it no longer waits (decided, withdrawn, gone). */
    take(workspaceId: string, workItemId: string): Promise<ApprovalItemTaken | null> {
        return this.items?.reopen(workspaceId, workItemId) ?? Promise.resolve(null)
    }

    /** Closes a taken item as approved by the member: the proposal keeps who approved, the result is its summary. */
    async approved(item: ApprovalItemTaken, memberId: string): Promise<void> {
        const proposal: Proposal = { ...item.proposal, fields: { ...item.proposal.fields, [APPROVED_BY_FIELD]: memberId } }
        await this.items?.markDone(item.id, {
            path: "human",
            proposal,
            result: { summary: proposal.summary },
            evidence: "captured",
            leadId: null,
        })
    }

    /** Closes a taken item as refused (by a person, the deadline or a withdrawal); `closedAs` names a close that was no verdict. */
    async refused(item: ApprovalItemTaken, locale: Locale, closedAs: string | null = null): Promise<void> {
        const proposal: Proposal =
            closedAs === null ? item.proposal : { ...item.proposal, fields: { ...item.proposal.fields, [CLOSED_AS_FIELD]: closedAs } }
        await this.items?.markRejected(item.id, proposal, {
            summary: this.catalog.get("engine.rejectedResult", {}, locale),
        })
    }

    /** Closes a taken item as failed: the verdict reached no run waiting on it. */
    async failed(item: ApprovalItemTaken, reason: string): Promise<void> {
        await this.items?.markFailed(item.id, reason)
    }

    /**
     * Closes the item refused while it still waits, with why (`closedAs`: a withdrawal, a take-over); false when it no longer waited
     * (decided meanwhile: that decision stands) or there is no store.
     */
    async withdrawn(workspaceId: string, workItemId: string, locale: Locale, closedAs: string): Promise<boolean> {
        const taken = await this.take(workspaceId, workItemId)
        if (taken === null) return false
        await this.refused(taken, locale, closedAs)
        return true
    }
}
