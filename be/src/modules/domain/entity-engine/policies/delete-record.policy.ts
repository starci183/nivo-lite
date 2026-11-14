import { IsNull } from "typeorm"
import { returnedRows, rowShape } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import type { RefDeleteRule } from "@nivo-lite/agent-sdk/entity"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { RecordEntity, RecordLinkEntity } from "../persistence/entities"
import { entityOf } from "./catalog-access.policy"
import { EntityEngineError, EntityEngineErrorCode } from "../errors/entity-engine.error"
import type { EntityCatalog } from "./compiler.contracts"
import { agentKeyOf } from "./agent-scope.policy"
import { recordRowOfEntity } from "./record-row.policy"
import type { ScopedTx } from "./scoped-tx.contracts"

/** What a delete did. */
export type DeleteOutcome =
    { readonly kind: "ok" } | { readonly kind: "missing" } | { readonly kind: "blocked"; readonly relation: string }

/** What a delete of several records did: the records it soft-deleted (the cascaded ones included), or the ref that refused it. */
export type DeleteManyOutcome =
    | { readonly kind: "ok"; readonly removed: ReadonlyArray<RemovedRecord> }
    | { readonly kind: "blocked"; readonly relation: string }

/** A record a delete soft-deleted: its type and id, and its row as it was when the caller asked for the rows. */
export interface RemovedRecord {
    /** The record type. */
    readonly entity: string
    /** The record id. */
    readonly id: string
    /** The record as it was, when asked (`rows`); null otherwise or when it was already gone. */
    readonly row: RecordRow | null
}

/** One record to delete. */
export interface DeleteTarget {
    /** The record type. */
    readonly entity: string
    /** The record id. */
    readonly id: string
}

/** How a delete runs: `force` deletes types that do not declare `deletable` (a contact erase); `rows` reads each record first. Every delete is a SOFT delete. */
export interface DeleteOptions {
    /** Delete even a type that does not declare `deletable` (the contact erase: the person's decision outranks it). */
    readonly force?: true
    /** Read every record before it is deleted. */
    readonly rows?: true
}

const isDeletedId = rowShape({ id: "string" })

/** A ref of some type that points at the deleted type, and what deleting its target does (`restrict` when undeclared). */
interface IncomingRelation {
    readonly from: string
    readonly relation: string
    readonly rule: RefDeleteRule
}

const incomingOf = (catalog: EntityCatalog, entity: string): Array<IncomingRelation> =>
    [...catalog.values()].flatMap((source) =>
        Object.entries(source.relations ?? {}).flatMap(([relation, definition]) =>
            definition.target === entity ? [{ from: source.name, relation, rule: definition.onDelete ?? "restrict" }] : [],
        ),
    )

const keyOf = (target: DeleteTarget): string => `${target.entity}\u0000${target.id}`

/**
 * The links of one relation that point at a record and start at a LIVE record: a soft-deleted record keeps its links (they come back with
 * it), but they never count as a reference: a deleted record neither cascades nor blocks.
 */
const liveLinksTo = (tx: ScopedTx, from: string, relation: string, target: DeleteTarget) =>
    tx.manager
        .createQueryBuilder(RecordLinkEntity, "k")
        .innerJoin(RecordEntity, "s", "s.entity = k.fromEntity AND s.id = k.fromId AND s.workspaceId = k.workspaceId")
        .where("k.workspaceId = :ws AND k.fromEntity = :from AND k.relation = :relation AND k.toEntity = :toEntity AND k.toId = :toId", {
            ws: tx.workspaceId,
            from,
            relation,
            toEntity: target.entity,
            toId: target.id,
        })

/**
 * The records a delete removes: the targets, then every record a `cascade` ref links to one of them, its own cascades in turn (each
 * once). A root of a type that does not declare `deletable` is refused unless `force`; a cascaded record goes whatever its type says
 * (the declared `cascade` is the permission).
 */
const doomedOf = async (
    tx: ScopedTx,
    catalog: EntityCatalog,
    roots: ReadonlyArray<DeleteTarget>,
    options: DeleteOptions,
): Promise<ReadonlyArray<DeleteTarget>> => {
    for (const root of roots) {
        const entity = entityOf(catalog, root.entity)
        if (entity.deletable !== true && options.force !== true)
            throw new EntityEngineError({ code: EntityEngineErrorCode.NotDeletable, params: { entity: entity.name } })
    }
    const doomed: Array<DeleteTarget> = []
    const seen = new Set<string>()
    const queue: Array<DeleteTarget> = [...roots]
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
        const target = next
        if (seen.has(keyOf(target))) continue
        seen.add(keyOf(target))
        doomed.push(target)
        await eachInOrder(
            incomingOf(catalog, target.entity).filter((incoming) => incoming.rule === "cascade"),
            async ({ from, relation }) => {
                const links = await liveLinksTo(tx, from, relation, target).getMany()
                for (const link of links) queue.push({ entity: link.fromEntity, id: link.fromId })
            },
        )
    }
    return doomed
}

/** The first `restrict` ref that still links to one of the records, or null (conservative: a link from a doomed record blocks too). */
const blockerOf = async (
    tx: ScopedTx,
    catalog: EntityCatalog,
    doomed: ReadonlyArray<DeleteTarget>,
): Promise<string | null> => {
    const blockers: Array<string> = []
    await eachInOrder(doomed, async (target) => {
        await eachInOrder(
            incomingOf(catalog, target.entity).filter((incoming) => incoming.rule === "restrict"),
            async ({ from, relation }) => {
                if (blockers.length > 0) return
                if ((await liveLinksTo(tx, from, relation, target).getCount()) > 0) blockers.push(relation)
            },
        )
    })
    return blockers[0] ?? null
}

/**
 * Soft-deletes one record: `deleted_at` is set and `version` bumped, in one statement; the row, its data and its links (both directions)
 * stay, hidden with it, so an un-delete brings them back. Nothing is ever hard-deleted. A record already deleted, or of another agent in a
 * scope confined to one agent, is not matched.
 */
const removeOne = async (tx: ScopedTx, target: DeleteTarget): Promise<boolean> => {
    const result = await tx.manager
        .createQueryBuilder(RecordEntity, "r")
        .update(RecordEntity)
        .set({ deletedAt: () => "now()", version: () => "version + 1" })
        .where({ entity: target.entity, id: target.id, workspaceId: tx.workspaceId, deletedAt: IsNull(), ...agentKeyOf(tx) })
        .returning("id")
        .execute()
    return returnedRows(result.raw, isDeletedId).length > 0
}

/**
 * SOFT-deletes records and applies every ref that points at them, in the caller's transaction: a `restrict` ref (the default) that still
 * links from a live record refuses the whole delete before anything is written (`blocked` names the ref); a `cascade` ref soft-deletes the
 * records that point at it too (their own refs applied in turn); a `clear` ref's source record stays (its link is hidden with the
 * deleted target). No row and no link is removed, so no file of a deleted record is either. The deleted records come back (with their rows
 * when `rows`).
 */
export const deleteRecords = async (
    tx: ScopedTx,
    catalog: EntityCatalog,
    roots: ReadonlyArray<DeleteTarget>,
    options: DeleteOptions = {},
): Promise<DeleteManyOutcome> => {
    const doomed = await doomedOf(tx, catalog, roots, options)
    const blocking = await blockerOf(tx, catalog, doomed)
    if (blocking !== null) return { kind: "blocked", relation: blocking }
    const removed: Array<RemovedRecord> = []
    await eachInOrder(doomed, async (target) => {
        const found =
            options.rows === true
                ? await tx.manager.findOne(RecordEntity, {
                      where: { entity: target.entity, id: target.id, workspaceId: tx.workspaceId },
                  })
                : null
        if (await removeOne(tx, target)) {
            removed.push({ ...target, row: found === null ? null : recordRowOfEntity(found) })
        }
    })
    return { kind: "ok", removed }
}

/**
 * Soft-deletes a record of a `deletable` entity, its refs applied (`deleteRecords`). `missing` when no live such record exists in the scope's
 * workspace; `blocked` names the `restrict` ref that still links to it.
 */
export const deleteRecord = async (
    tx: ScopedTx,
    catalog: EntityCatalog,
    entityName: string,
    id: string,
): Promise<DeleteOutcome> => {
    const entity = entityOf(catalog, entityName)
    const outcome = await deleteRecords(tx, catalog, [{ entity: entity.name, id }])
    if (outcome.kind === "blocked") return outcome
    return outcome.removed.some((removed) => removed.entity === entity.name && removed.id === id)
        ? { kind: "ok" }
        : { kind: "missing" }
}
