import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { WorkItemEntity } from "./persistence/entities"
import type { DepartmentWork, WorkException, WorkFigure } from "./work-items-read.contracts"

/** The states an exception list shows. */
const EXCEPTION_STATES = ["waiting_decision", "failed"] as const

/** The texts a proposal carries that the lists show. */
const PROPOSAL_SUMMARY = "w.proposal ->> 'summary'"
const PROPOSAL_CONTACT = "w.proposal -> 'fields' ->> 'contact_name'"
const PROPOSAL_CUSTOMER = "w.proposal -> 'fields' ->> 'customer'"

@Injectable()
/** The dashboard counts and lists of a workspace's work items, always scoped to the workspace and bounded by the caller. */
export class WorkItemsReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** How many work items of the workspace stand in one state. */
    countByStatus(workspaceId: string, status: string): Promise<number> {
        return this.entityManager
            .createQueryBuilder(WorkItemEntity, "w")
            .where("w.workspaceId = :workspaceId AND w.status = :status", { workspaceId, status })
            .getCount()
    }

    /** The newest work items with what the governance figures read from them, newest first. */
    newestFigures(workspaceId: string, limit: number): Promise<Array<WorkFigure>> {
        return this.entityManager
            .createQueryBuilder(WorkItemEntity, "w")
            .select("w.id", "id")
            .addSelect("w.leadId", "leadId")
            .addSelect("w.department", "department")
            .addSelect("w.status", "status")
            .addSelect("w.reason", "reason")
            .addSelect("w.decidedPath", "decidedPath")
            .addSelect("w.createdAt", "createdAt")
            .addSelect("w.updatedAt", "updatedAt")
            .addSelect("w.completedAt", "completedAt")
            .addSelect(PROPOSAL_SUMMARY, "summary")
            .addSelect(PROPOSAL_CONTACT, "contact")
            .addSelect(PROPOSAL_CUSTOMER, "customer")
            .where("w.workspaceId = :workspaceId", { workspaceId })
            .orderBy("w.createdAt", "DESC")
            .limit(limit)
            .getRawMany<WorkFigure>()
    }

    /** The work items waiting for a decision or failed, oldest first. */
    exceptions(workspaceId: string, limit: number): Promise<Array<WorkException>> {
        return this.entityManager
            .createQueryBuilder(WorkItemEntity, "w")
            .select("w.id", "id")
            .addSelect("w.leadId", "leadId")
            .addSelect("w.department", "department")
            .addSelect("w.action", "action")
            .addSelect("w.status", "status")
            .addSelect("w.reason", "reason")
            .addSelect("w.error", "error")
            .addSelect("w.executionId", "executionId")
            .addSelect("w.assignedStaffId", "assignedStaffId")
            .addSelect("w.createdAt", "createdAt")
            .addSelect(PROPOSAL_SUMMARY, "summary")
            .addSelect(PROPOSAL_CONTACT, "contact")
            .addSelect(PROPOSAL_CUSTOMER, "customer")
            .where("w.workspaceId = :workspaceId AND w.status IN (:...states)", {
                workspaceId,
                states: [...EXCEPTION_STATES],
            })
            .orderBy("w.createdAt", "ASC")
            .limit(limit)
            .getRawMany<WorkException>()
    }

    /** The newest work items of one department of the workspace, by finish (else last change), newest first. */
    recentOfDepartment(workspaceId: string, department: string, limit: number): Promise<Array<DepartmentWork>> {
        return this.entityManager
            .createQueryBuilder(WorkItemEntity, "w")
            .select("w.id", "id")
            .addSelect("w.action", "action")
            .addSelect("w.status", "status")
            .addSelect("to_json(COALESCE(w.completed_at, w.updated_at)) #>> '{}'", "at")
            .addSelect("COALESCE(NULLIF(w.result->>'summary', ''), w.proposal->>'summary')", "summary")
            .addSelect(PROPOSAL_CUSTOMER, "customer")
            .addSelect("w.leadId", "leadId")
            .where("w.workspaceId = :workspaceId AND w.department = :department", { workspaceId, department })
            .orderBy("COALESCE(w.completed_at, w.updated_at)", "DESC")
            .addOrderBy("w.id", "ASC")
            .limit(limit)
            .getRawMany<DepartmentWork>()
    }
}
