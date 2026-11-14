import type { ObjectLiteral, SelectQueryBuilder } from "typeorm"
import { ContactEntity } from "@modules/domain/contacts/persistence/entities"

/**
 * SOFT DELETE (owner rulings R31 and R36): a deleted contact, and a removed provider account, keep their routes and customer lines in
 * the database and every read leaves them out. This narrows a read of a table that names a contact (`contactId`, `workspaceId`) and an
 * entrance account (`accountId`: a connection, a website site or an API key, or null) to the rows whose contact is not deleted (the
 * contact's own mark, `erased_at`) and whose account is not a REMOVED connection (`connections.deleted_at`; a site, a key or no account
 * is never one): the one place the rule is written, so no reader can forget it. A merged contact is not deleted (its mark is empty): its
 * rows are read under it, as before; deleting the survivor marks every id merged into it too.
 */
export const ofLiveContact = <Row extends ObjectLiteral>(query: SelectQueryBuilder<Row>, alias: string): SelectQueryBuilder<Row> =>
    query.innerJoin(
        ContactEntity,
        "contact",
        `contact.id = ${alias}.contactId AND contact.workspaceId = ${alias}.workspaceId AND contact.erasedAt IS NULL ` +
            `AND NOT EXISTS (SELECT 1 FROM public.connections removed WHERE removed.id = ${alias}.accountId AND removed.deleted_at IS NOT NULL)`,
    )
