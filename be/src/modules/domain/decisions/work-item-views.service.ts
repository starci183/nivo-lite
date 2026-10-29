import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { LeadReadService } from "@modules/domain/leads"
import { StaffDirectoryService } from "@modules/domain/staff"
import { WorkItemsViewsReadService } from "@modules/domain/work-items"
import type { WorkItemWithCursor } from "@modules/domain/work-items"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { DecisionEntity } from "./persistence/entities"
import type { AccountingWaitingWorkRow, WorkItemViewRow } from "./work-item-views.rows"

/** One page of work items asked for: no status filter when `statuses` is empty, no action filter when `action` is null. */
export interface WorkItemViewFilter {
    /** The statuses to keep. */
    readonly statuses: ReadonlyArray<string>
    /** The keyset position after which the page starts. */
    readonly after: { readonly createdAt: string; readonly id: string } | null
    /** The action to keep. */
    readonly action: string | null
    /** How many rows. */
    readonly limit: number
}

@Injectable()
/** Reads the work items of a workspace as views: the item, its latest decision and, for accounting, its customer and staff member. */
export class WorkItemViewsService {
    /** Captures the work items, leads and staff read services and the primary entity manager. */
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly items: WorkItemsViewsReadService,
        private readonly leads: LeadReadService,
        private readonly staff: StaffDirectoryService,
    ) {}

    /** One work item of the workspace, with the latest decision's name as `decidedBy` and `deciderName`; undefined when there is none. */
    async find(workspaceId: string, workItemId: string): Promise<WorkItemViewRow | undefined> {
        const found = await this.items.find(workspaceId, workItemId)
        if (found === null) return undefined
        const [row] = await this.withDeciders(workspaceId, [found])
        return row
    }

    /** One page of the workspace's work items, newest first, keyset on (created_at, id). */
    async list(workspaceId: string, filter: WorkItemViewFilter): Promise<Array<WorkItemViewRow>> {
        const page = await this.items.listPage(workspaceId, filter)
        return this.withDeciders(workspaceId, page)
    }

    /** Waiting accounting work with its customer and assigned staff member, oldest first. */
    async accountingWaiting(workspaceId: string, limit: number): Promise<Array<AccountingWaitingWorkRow>> {
        const items = await this.items.waitingAccounting(workspaceId, limit)
        const leadIds = items.flatMap((item) => (item.lead_id === null ? [] : [item.lead_id]))
        const staffIds = items.flatMap((item) => (item.assigned_staff_id === null ? [] : [item.assigned_staff_id]))
        const cards = new Map((await this.leads.cardsOf(workspaceId, leadIds)).map((card) => [card.id, card]))
        const names = new Map((await this.staff.namesOf(workspaceId, staffIds)).map((staff) => [staff.id, staff.name]))
        return items.map((item) => {
            const card = item.lead_id === null ? undefined : cards.get(item.lead_id)
            return {
                ...item,
                lead:
                    card === undefined
                        ? null
                        : {
                              id: card.id,
                              contact_name: card.contactName,
                              company: card.company,
                              channel: card.channel,
                          },
                assigned_staff_name:
                    item.assigned_staff_id === null ? null : (names.get(item.assigned_staff_id) ?? null),
            }
        })
    }

    /** The pages' items with the name of each one's latest decider, under `decidedBy` and `deciderName`. */
    private async withDeciders(
        workspaceId: string,
        page: ReadonlyArray<WorkItemWithCursor>,
    ): Promise<Array<WorkItemViewRow>> {
        if (page.length === 0) return []
        const latest = await this.entityManager
            .createQueryBuilder(DecisionEntity, "d")
            .select("d.workItemId", "work_item_id")
            .addSelect("d.decidedBy", "decided_by")
            .distinctOn(["d.workItemId"])
            .where("d.workspaceId = :workspaceId AND d.workItemId IN (:...ids)", {
                workspaceId,
                ids: page.map(({ item }) => item.id),
            })
            .orderBy("d.workItemId")
            .addOrderBy("d.createdAt", "DESC")
            .addOrderBy("d.id", "DESC")
            .limit(page.length)
            .getRawMany<{ work_item_id: string; decided_by: string }>()
        const names = new Map(latest.map((line) => [line.work_item_id, line.decided_by]))
        return page.map(({ item, cursorAt }) => {
            const decidedBy = names.get(item.id) ?? null
            return { ...item, cursor_at: cursorAt, decidedBy, deciderName: decidedBy }
        })
    }
}
