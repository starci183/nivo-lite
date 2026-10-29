import { builder } from "@starci/jest-preset"
import type { LedgerRecord, PublicApiEntity } from "@modules/domain/public-api"

/** The workspace the ledger specs write for. */
export const LEDGER_WORKSPACE = "11111111-1111-4111-8111-111111111111"

/** A ledger row as the lock read answers it, with any column overridden. */
export const ledgerRowOf = builder<PublicApiEntity>({
    id: "22222222-2222-4222-8222-222222222222",
    workspaceId: LEDGER_WORKSPACE,
    keyId: "key-1",
    kind: "knowledge",
    dedupeKey: "knowledge:key-1:",
    payload: {
        title: "Guide",
        content: "Answer",
        topic: null,
        tags: ["sales"],
        visibility: "internal",
        source: "api:CRM",
    },
    needSupplied: null,
    leadId: null,
    duplicates: 0,
    processedAt: null,
    createdAt: new Date("2026-10-24T08:00:00Z"),
})

/** A ledger row already processed. */
export const PROCESSED_LEDGER_ROW: PublicApiEntity = ledgerRowOf({ processedAt: new Date("2026-10-25T00:00:00Z") })

/** A ledger row of another kind and payload, optionally with the lead need the caller supplied. */
export const ledgerRowOfKind = (
    kind: PublicApiEntity["kind"],
    payload: PublicApiEntity["payload"],
    needSupplied: boolean | null = null,
): PublicApiEntity => ledgerRowOf({ kind, payload, needSupplied })

/** The shape of a ledger insert, with the dedupe expression reduced to its type name. */
interface LedgerCalls {
    /** The inserted values. */
    readonly values: ReadonlyArray<unknown>
    /** The named parameters. */
    readonly parameters: ReadonlyArray<unknown>
    /** The conflict clause. */
    readonly onConflict: ReadonlyArray<unknown>
    /** The returned columns. */
    readonly returning: ReadonlyArray<unknown>
}

/** A recorder that answers the arguments of the calls of one builder method. */
interface CallRecorder {
    /** The arguments of every call of one method, in order. */
    argsOf(method: string): ReadonlyArray<ReadonlyArray<unknown>>
}

const isValues = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null

/** What a recorder saw of a ledger insert. */
export const ledgerWritten = (write: CallRecorder): LedgerCalls => ({
    values: write.argsOf("values").map(([row]) => (isValues(row) ? { ...row, dedupeKey: typeof row.dedupeKey } : row)),
    parameters: write.argsOf("setParameters"),
    onConflict: write.argsOf("onConflict"),
    returning: write.argsOf("returning"),
})

/** What a ledger insert of this record must have recorded. */
export const ledgerExpected = (expected: LedgerRecord): LedgerCalls => ({
    values: [
        {
            workspaceId: expected.workspaceId,
            keyId: expected.keyId,
            kind: expected.kind,
            dedupeKey: "function",
            payload: expected.body,
            needSupplied: expected.needSupplied ?? null,
        },
    ],
    parameters: [[{ prefix: expected.prefix, suffix: expected.suffix }]],
    onConflict: [["(workspace_id, dedupe_key) DO UPDATE SET duplicates = public_api.duplicates + 1"]],
    returning: [["id, lead_id, (xmax = 0) AS inserted"]],
})
