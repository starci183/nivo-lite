import type { EntityManager } from "typeorm"
import { sql } from "@modules/platform/database"

const CHECK_HISTORY_PARENT = sql`SET CONSTRAINTS public_document_approvals_document_id_fkey IMMEDIATE`
const CHECK_PUBLICATION_POINTER = sql`SET CONSTRAINTS public_documents_approved_revision_fkey IMMEDIATE`

/** Forces the real deferred history-parent constraint to run before a rollback-only role proof ends. */
export const enforcePublicHistoryParent = async (manager: EntityManager): Promise<void> => {
    await manager.query(CHECK_HISTORY_PARENT)
}

/** Enforces the real live-approval pointer, including while the world removes a whole workspace. */
export const enforcePublicApprovalPointer = async (manager: EntityManager): Promise<void> => {
    await manager.query(CHECK_PUBLICATION_POINTER)
}
