import { isRecord } from "@modules/platform/primitives"
import { WorkspaceCleanupError, WorkspaceCleanupErrorCode } from "./errors/workspace-cleanup.error"
import type { UserReferenceRow } from "./persistence/workspace-cleanup.rows"
import type { UserReferences } from "./workspace-cleanup.contracts"
import { countsOf, nonZero } from "./workspace-cleanup.policy"

const INVALID = WorkspaceCleanupErrorCode.ReferencesInvalid

const invalid = (): never => {
    throw new WorkspaceCleanupError({ code: INVALID })
}

/** Reads the references of each account from its row; a missing account or a malformed row is refused. */
export const userReferencesOf = (
    ids: ReadonlyArray<string>,
    rows: ReadonlyArray<UserReferenceRow>,
): ReadonlyMap<string, UserReferences> => {
    const references = new Map<string, UserReferences>()
    for (const row of rows) {
        const refs = isRecord(row.refs) && !Array.isArray(row.refs) ? row.refs : invalid()
        references.set(row.user_id, {
            cascade: countsOf(refs.cascade, INVALID),
            block: countsOf(refs.block, INVALID),
        })
    }
    if (!ids.every((id) => references.has(id))) invalid()
    return references
}

/** One account the refusal names, with the `<table>.<column>` keys whose rows stop it. */
interface Offender {
    readonly id: string
    readonly tables: ReadonlyArray<string>
}

/** Orders the `<table>.<column>` keys a refusal names alphabetically, for the operator who reads it. */
const byName = (left: string, right: string): number => left.localeCompare(right)

const offendersOf = (
    references: ReadonlyMap<string, UserReferences>,
    pick: (refs: UserReferences) => Readonly<Record<string, number>>,
): ReadonlyArray<Offender> =>
    [...references]
        .map(([id, refs]) => ({ id, tables: Object.keys(nonZero(pick(refs))).sort(byName) }))
        .filter((offender) => offender.tables.length > 0)

const refuse = (code: WorkspaceCleanupErrorCode, offenders: ReadonlyArray<Offender>): never => {
    throw new WorkspaceCleanupError({
        code,
        params: {
            users: offenders.map((offender) => offender.id).join(","),
            tables: [...new Set(offenders.flatMap((offender) => offender.tables))].sort(byName).join(","),
        },
    })
}

/**
 * Refuses, in the dry run already, every account delete that would fail or surprise: kept rows that block the delete always,
 * kept rows the delete would cascade-delete unless `--allow-kept-cascade` is set. The error names the users and the tables.
 */
export const assertUserReferences = (
    references: ReadonlyMap<string, UserReferences>,
    allowKeptCascade: boolean,
): void => {
    const blocked = offendersOf(references, (refs) => refs.block)
    if (blocked.length > 0) refuse(WorkspaceCleanupErrorCode.UserReferenceBlocked, blocked)
    const cascading = allowKeptCascade ? [] : offendersOf(references, (refs) => refs.cascade)
    if (cascading.length > 0) refuse(WorkspaceCleanupErrorCode.KeptCascadeRefused, cascading)
}
