import "server-only"

import type { Staff, WorkItemView } from "@/lib/flow-types"
import type { AccountingWorkbenchData } from "@/modules/types"
import type { DbOutcome } from "../outcome"
import { dbOk } from "../outcome"
import { buildAccountingWorkbench } from "./accounting.mapper"
import { readAccountingBook } from "./read-accounting-book"

/** What the Accounting workbench needs from the caller besides the records: the workspace, the waiting work and who is looking. */
export interface AccountingWorkbenchQuery {
    readonly workspaceId: string
    readonly exceptions: ReadonlyArray<WorkItemView>
    readonly staff: ReadonlyArray<Staff>
    readonly ownerName: string
    readonly role: string
}

/** Reads the records of one workspace under the caller's RLS and derives the whole Accounting workbench from them. */
export const readAccountingWorkbench = async (
    query: AccountingWorkbenchQuery,
): Promise<DbOutcome<AccountingWorkbenchData>> => {
    const book = await readAccountingBook(query.workspaceId)
    if (book.kind !== "ok") return book
    return dbOk(
        buildAccountingWorkbench({
            book: book.value,
            now: new Date(),
            exceptions: query.exceptions,
            staff: query.staff,
            ownerName: query.ownerName,
            role: query.role,
        }),
    )
}
