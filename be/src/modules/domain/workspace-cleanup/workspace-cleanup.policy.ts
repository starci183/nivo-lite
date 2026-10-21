import { createHash } from "node:crypto"
import { isRecord } from "@modules/platform/primitives"
import { WorkspaceCleanupError, WorkspaceCleanupErrorCode } from "./errors/workspace-cleanup.error"
import { CLEANUP_RECEIPT_SCHEMA } from "./messages/workspace-cleanup.messages"
import type { WorkspaceFootprintRow } from "./persistence/workspace-cleanup.rows"
import type { CleanupAuthUser } from "./workspace-cleanup.options"
import type {
    CleanupCommand,
    CleanupMode,
    CleanupReceipt,
    KeptWorkspace,
    RemovedWorkspace,
    UserReferences,
} from "./workspace-cleanup.contracts"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const DIGEST = /^[0-9a-f]{64}$/
const KEEP_MAX = 20

/** Tables that cascade from public.workspaces but that the footprint cannot count (the cli role holds no grant on them); the
 * cascade still deletes their rows. */
export const UNCOUNTED_TABLES: ReadonlyArray<string> = ["job_outbox"]

const fail = (code: WorkspaceCleanupErrorCode): never => {
    throw new WorkspaceCleanupError({ code })
}

/**
 * Orders two texts by UTF-16 code unit, the order of a plain `sort()`: the receipt and its digest must read the same on every
 * host, which a locale-aware compare does not promise.
 */
const byCodeUnit = (left: string, right: string): number => (left < right ? -1 : Number(left > right))

const byId = <Row extends { readonly id: string }>(left: Row, right: Row): number => byCodeUnit(left.id, right.id)

/** Reads `--keep a,b`: lower-case workspace ids, unique and sorted; an empty list or a malformed id is refused. */
export const parseKeepList = (raw: string | undefined): ReadonlyArray<string> => {
    const ids = [
        ...new Set(
            (raw ?? "")
                .split(",")
                .map((id) => id.trim().toLowerCase())
                .filter((id) => id.length > 0),
        ),
    ].sort(byCodeUnit)
    if (ids.length === 0) fail(WorkspaceCleanupErrorCode.KeepRequired)
    if (ids.length > KEEP_MAX || !ids.every((id) => UUID.test(id))) fail(WorkspaceCleanupErrorCode.KeepInvalid)
    return ids
}

/** Exactly one of `--dry-run` and `--execute`; an execute names a well-formed receipt digest. */
export const cleanupModeOf = (command: CleanupCommand): CleanupMode => {
    if ((command.dryRun === true) === (command.execute === true)) fail(WorkspaceCleanupErrorCode.ModeRequired)
    if (command.dryRun === true) return "dry-run"
    if (!DIGEST.test(command.receiptDigest?.trim().toLowerCase() ?? "")) fail(WorkspaceCleanupErrorCode.DigestRequired)
    return "execute"
}

/** Whether the digest the operator gives is the one of the fresh receipt. */
export const digestMatches = (digest: string, given: string | undefined): boolean =>
    digest === given?.trim().toLowerCase()

/** JSON with the keys of every object sorted, so one receipt always has one text. */
export const canonicalJson = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
    if (isRecord(value)) {
        const entryOf = (key: string): string => `${JSON.stringify(key)}:${canonicalJson(value[key])}`
        return `{${Object.keys(value).sort(byCodeUnit).map(entryOf).join(",")}}`
    }
    return JSON.stringify(value)
}

/** The sha256 (hex) of the canonical receipt JSON. */
export const receiptDigestOf = (receipt: CleanupReceipt): string =>
    createHash("sha256").update(canonicalJson(receipt)).digest("hex")

/** Masks an email to its first letter and its domain (`h***@gmail.com`), so the receipt names no full address. */
export const maskEmail = (email: string | undefined): string | null => {
    const at = email?.lastIndexOf("@") ?? -1
    if (email === undefined || at < 1) return null
    return `${email.slice(0, 1)}***${email.slice(at).toLowerCase()}`
}

const countOf = (count: unknown, code: WorkspaceCleanupErrorCode): number =>
    typeof count === "number" && Number.isSafeInteger(count) && count >= 0 ? count : fail(code)

/** Reads a jsonb object of row counts by name; anything else is refused with `code`. */
export const countsOf = (raw: unknown, code: WorkspaceCleanupErrorCode): Readonly<Record<string, number>> => {
    const counts = isRecord(raw) && !Array.isArray(raw) ? raw : fail(code)
    const rows: Record<string, number> = {}
    for (const [name, count] of Object.entries(counts)) rows[name] = countOf(count, code)
    return rows
}

const footprintOf = (row: WorkspaceFootprintRow): RemovedWorkspace => {
    const rows = countsOf(row.footprint, WorkspaceCleanupErrorCode.FootprintInvalid)
    const total = Object.values(rows).reduce((sum, count) => sum + count, 0)
    return { id: row.id, name: row.name, rows, total }
}

/** The kept workspaces, by id; a keep id that is not in the database is refused, so nothing is deleted. */
export const keptWorkspacesOf = (
    keep: ReadonlyArray<string>,
    workspaces: ReadonlyArray<WorkspaceFootprintRow>,
): ReadonlyArray<KeptWorkspace> => {
    const kept = workspaces.filter((workspace) => keep.includes(workspace.id))
    if (kept.length !== keep.length) fail(WorkspaceCleanupErrorCode.KeepNotFound)
    return kept.map((workspace) => ({ id: workspace.id, name: workspace.name })).sort(byId)
}

/** The accounts no kept workspace holds, by id. */
export const orphanAccountsOf = (
    users: ReadonlyArray<CleanupAuthUser>,
    keptUsers: ReadonlySet<string>,
): ReadonlyArray<CleanupAuthUser> => users.filter((user) => !keptUsers.has(user.id)).sort(byId)

/** The facts a receipt is built from. */
export interface ReceiptFacts {
    /** The kept workspace ids, as parsed. */
    readonly keep: ReadonlyArray<string>
    /** Every workspace with its footprint. */
    readonly workspaces: ReadonlyArray<WorkspaceFootprintRow>
    /** The accounts no kept workspace holds. */
    readonly orphans: ReadonlyArray<CleanupAuthUser>
    /** What deleting each orphan account would do to kept data, by account id. */
    readonly references: ReadonlyMap<string, UserReferences>
    /** Whether account deletes may cascade-delete kept rows. */
    readonly allowKeptCascade: boolean
}

/** Builds the receipt: kept and removed workspaces and the orphan accounts with their kept cascade, each sorted by id. */
export const buildReceipt = (facts: ReceiptFacts): CleanupReceipt => {
    const removed = facts.workspaces.filter((workspace) => !facts.keep.includes(workspace.id))
    return {
        schema: CLEANUP_RECEIPT_SCHEMA,
        keep: keptWorkspacesOf(facts.keep, facts.workspaces),
        remove: removed.map(footprintOf).sort(byId),
        orphanUsers: facts.orphans.map((user) => ({
            id: user.id,
            email: maskEmail(user.email),
            keptCascade: nonZero(
                facts.references.get(user.id)?.cascade ?? fail(WorkspaceCleanupErrorCode.ReferencesInvalid),
            ),
        })),
        uncounted: [...UNCOUNTED_TABLES],
        allowKeptCascade: facts.allowKeptCascade,
    }
}

/** Only the entries above zero. */
export const nonZero = (counts: Readonly<Record<string, number>>): Readonly<Record<string, number>> =>
    Object.fromEntries(Object.entries(counts).filter(([, count]) => count > 0))
