import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ResponsibilityEntity } from "@modules/domain/responsibilities"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    OverviewAgent,
    OverviewEvent,
    OverviewException,
    OverviewExceptionLead,
    OverviewLead,
    OverviewPending,
    OverviewResponsibility,
} from "./overview.contracts"

/** How many responsibilities the dashboard reads. */
const RESPONSIBILITY_LIMIT = 2000
/** How many agents the dashboard reads. */
const AGENT_LIMIT = 200
/** How many leads the figures count. */
const LEAD_LIMIT = 10_000
/** How many drafts waiting for a decision the dashboard reads. */
const PENDING_LIMIT = 2000
/** How many exceptions the dashboard lists. */
const EXCEPTION_LIMIT = 100

/** The text a timestamp had inside the former jsonb answer: ISO 8601 with an offset and trimmed fractional zeros. */
export const instant = (column: string): string => `to_jsonb(${column}) #>> '{}'`

/** A responsibility read joined to its lead, flat. */
interface ResponsibilityFacts extends Omit<OverviewResponsibility, "lead"> {
    /** The lead's id. */
    readonly leadRef: string
    /** The lead's contact. */
    readonly leadContactName: string
    /** The lead's company. */
    readonly leadCompany: string
    /** The lead's stage. */
    readonly leadStage: string
}

/** An exception read with its lead columns, flat. */
interface ExceptionFacts extends Omit<OverviewException, "lead"> {
    /** The lead's id; null when the lead is gone. */
    readonly leadRef: string | null
    /** The lead's contact. */
    readonly leadContactName: string | null
    /** The lead's company. */
    readonly leadCompany: string | null
    /** The lead's channel. */
    readonly leadChannel: string | null
}

/** The lead of an exception, or null when the join found none. */
const exceptionLeadOf = (row: ExceptionFacts): OverviewExceptionLead | null =>
    row.leadRef === null
        ? null
        : {
              id: row.leadRef,
              contactName: row.leadContactName ?? "",
              company: row.leadCompany ?? "",
              channel: row.leadChannel ?? "",
          }

@Injectable()
/** The list reads of the executive dashboard, each bounded as the former statement was. */
export class OverviewReadsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Every responsibility with its lead, due soonest first. */
    async responsibilities(workspaceId: string): Promise<Array<OverviewResponsibility>> {
        const rows = await this.entityManager
            .createQueryBuilder(ResponsibilityEntity, "r")
            .select("r.id", "id")
            .addSelect("r.lead_id", "leadId")
            .addSelect("r.title", "title")
            .addSelect("r.owner_kind", "ownerKind")
            .addSelect("r.owner_agent_id", "ownerAgentId")
            .addSelect("r.owner_name", "ownerName")
            .addSelect("r.next_action", "nextAction")
            .addSelect(instant("r.due_at"), "dueAt")
            .addSelect("r.status", "status")
            .addSelect(instant("r.created_at"), "createdAt")
            .addSelect("l.id", "leadRef")
            .addSelect("l.contact_name", "leadContactName")
            .addSelect("l.company", "leadCompany")
            .addSelect("l.stage", "leadStage")
            .innerJoin("leads", "l", "l.id = r.lead_id")
            .where("r.workspace_id = :workspaceId", { workspaceId })
            .orderBy("r.due_at", "ASC", "NULLS LAST")
            .limit(RESPONSIBILITY_LIMIT)
            .getRawMany<ResponsibilityFacts>()
        return rows.map(
            ({ leadRef, leadContactName, leadCompany, leadStage, ...responsibility }): OverviewResponsibility => ({
                ...responsibility,
                lead: { id: leadRef, contactName: leadContactName, company: leadCompany, stage: leadStage },
            }),
        )
    }

    /** The agents, oldest first. */
    agents(workspaceId: string): Promise<Array<OverviewAgent>> {
        return this.entityManager
            .createQueryBuilder()
            .select("a.id", "id")
            .addSelect("a.module", "module")
            .addSelect("a.name", "name")
            .addSelect("a.handle", "handle")
            .addSelect("a.role", "role")
            .addSelect("a.instructions", "instructions")
            .addSelect("a.knowledge", "knowledge")
            .addSelect("a.greeting", "greeting")
            .addSelect("a.approval_rule", "approvalRule")
            .addSelect("a.status", "status")
            .addSelect(instant("a.created_at"), "createdAt")
            .from("public.agents", "a")
            .where("a.workspace_id = :workspaceId", { workspaceId })
            .orderBy("a.created_at")
            .limit(AGENT_LIMIT)
            .getRawMany<OverviewAgent>()
    }

    /** The newest evidence lines, newest first. */
    events(workspaceId: string, count: number): Promise<Array<OverviewEvent>> {
        return this.entityManager
            .createQueryBuilder()
            .select("e.id", "id")
            .addSelect("e.lead_id", "leadId")
            .addSelect("e.kind", "kind")
            .addSelect("e.actor", "actor")
            .addSelect("e.summary", "summary")
            .addSelect("e.evidence", "evidence")
            .addSelect(instant("e.created_at"), "createdAt")
            .from("public.events", "e")
            .where("e.workspace_id = :workspaceId", { workspaceId })
            .orderBy("e.created_at", "DESC")
            .limit(count)
            .getRawMany<OverviewEvent>()
    }

    /** The leads the overview figures count. */
    leads(workspaceId: string): Promise<Array<OverviewLead>> {
        return this.entityManager
            .createQueryBuilder()
            .select("l.id", "id")
            .addSelect("l.stage", "stage")
            .addSelect(instant("l.created_at"), "createdAt")
            .addSelect("l.contact_name", "contactName")
            .addSelect("l.company", "company")
            .from("public.leads", "l")
            .where("l.workspace_id = :workspaceId", { workspaceId })
            .limit(LEAD_LIMIT)
            .getRawMany<OverviewLead>()
    }

    /** The drafts waiting for a decision with the lead behind each, newest first. */
    pending(workspaceId: string): Promise<Array<OverviewPending>> {
        const query = this.entityManager.createQueryBuilder()
        const lead = query
            .subQuery()
            .select("r.lead_id")
            .from("public.responsibilities", "r")
            .where("r.id = x.responsibility_id")
            .getQuery()
        return query
            .select("x.id", "id")
            .addSelect("x.responsibility_id", "responsibilityId")
            .addSelect(instant("x.created_at"), "createdAt")
            .addSelect(lead, "leadId")
            .from("public.executions", "x")
            .where("x.workspace_id = :workspaceId AND x.status = 'pending_approval'", { workspaceId })
            .orderBy("x.created_at", "DESC")
            .limit(PENDING_LIMIT)
            .getRawMany<OverviewPending>()
    }

    /** The work items waiting for a decision or failed, with their lead and assigned staff, oldest first. */
    async exceptions(workspaceId: string): Promise<Array<OverviewException>> {
        const query = this.entityManager.createQueryBuilder()
        const staff = query
            .subQuery()
            .select("s.name")
            .from("public.staff", "s")
            .where("s.id = w.assigned_staff_id")
            .getQuery()
        const rows = await query
            .select("w.id", "id")
            .addSelect("w.lead_id", "leadId")
            .addSelect("w.department", "department")
            .addSelect("w.action", "action")
            .addSelect("w.status", "status")
            .addSelect("w.reason", "reason")
            .addSelect("w.error", "error")
            .addSelect("w.execution_id", "executionId")
            .addSelect(instant("w.created_at"), "createdAt")
            .addSelect(staff, "assignedStaffName")
            .addSelect("w.proposal ->> 'summary'", "summary")
            .addSelect("w.proposal -> 'fields' ->> 'contact_name'", "contact")
            .addSelect("w.proposal -> 'fields' ->> 'customer'", "customer")
            .addSelect("l.id", "leadRef")
            .addSelect("l.contact_name", "leadContactName")
            .addSelect("l.company", "leadCompany")
            .addSelect("l.channel", "leadChannel")
            .from("public.work_items", "w")
            .leftJoin("leads", "l", "l.id = w.lead_id")
            .where("w.workspace_id = :workspaceId AND w.status IN ('waiting_decision', 'failed')", { workspaceId })
            .orderBy("w.created_at")
            .limit(EXCEPTION_LIMIT)
            .getRawMany<ExceptionFacts>()
        return rows.map((row): OverviewException => ({
            id: row.id,
            leadId: row.leadId,
            department: row.department,
            action: row.action,
            status: row.status,
            reason: row.reason,
            error: row.error,
            executionId: row.executionId,
            assignedStaffName: row.assignedStaffName,
            createdAt: row.createdAt,
            summary: row.summary,
            contact: row.contact,
            customer: row.customer,
            lead: exceptionLeadOf(row),
        }))
    }
}
