import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { STEP_ENTRY_KINDS } from "./contact-work.policy"
import type { ContactWorkRow, ContactWorkStore } from "./contact-work-store.port"
import { ContactEntity, ContactMemoryEntryEntity } from "./persistence/entities"

@Injectable()
/**
 * The step outcomes of a person on public.contact_memory, on the primary connection. One read: the entries under the subject key
 * (index `contact_memory_subject`: workspace, subject, id), of the step kinds only, newest first and bounded. A deleted contact's
 * entries stay in the table (soft delete, R31) and the join leaves them out, as `entriesOf` does.
 */
export class TypeormContactWorkStore implements ContactWorkStore {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The step outcomes under the subject key, newest first, at most `limit`. */
    async recentOf(workspaceId: string, subjectKey: string, limit: number): Promise<ReadonlyArray<ContactWorkRow>> {
        const rows = await this.entityManager
            .createQueryBuilder(ContactMemoryEntryEntity, "entry")
            .leftJoin(ContactEntity, "contact", "contact.id = entry.contactId")
            .where("entry.workspaceId = :workspaceId", { workspaceId })
            .andWhere("entry.subjectKey = :subjectKey", { subjectKey })
            .andWhere("entry.kind IN (:...kinds)", { kinds: [...STEP_ENTRY_KINDS] })
            .andWhere("(entry.contactId IS NULL OR contact.erasedAt IS NULL)")
            .orderBy("entry.writtenAt", "DESC")
            .addOrderBy("entry.id", "DESC")
            .limit(limit)
            .getMany()
        return rows.map((row) => ({
            id: row.id,
            namespace: row.namespace,
            nodeKey: row.nodeKey,
            step: row.step,
            status: row.kind,
            at: row.writtenAt.toISOString(),
            agentId: row.agentId,
            workflowId: row.workflowId,
            runId: row.runId,
        }))
    }
}
