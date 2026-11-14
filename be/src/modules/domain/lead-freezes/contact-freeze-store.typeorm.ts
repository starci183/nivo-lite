import { Injectable } from "@nestjs/common"
import type { EntityManager, FindOptionsWhere } from "typeorm"
import type { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { ContactFreezeStore, FreezeLookup } from "./contact-freeze-store.port"
import { freezeOf, pendingJsonOf } from "./lead-freezes.mapper"
import type { FreezeStatus, FreezeSubject, FreezeValues, LeadFreeze } from "./lead-freezes.contracts"
import { ContactFreezeEntity } from "./persistence/entities"

const dateOf = (value: string | null): Date | null => (value === null ? null : new Date(value))

/** The columns of the members a write sets: the pending events as `{ events }`, the times as instants. */
const columnsOf = (values: FreezeValues): QueryDeepPartialEntity<ContactFreezeEntity> => ({
    ...(values.contactId === undefined ? {} : { contactId: values.contactId }),
    ...(values.conversationId === undefined ? {} : { conversationId: values.conversationId }),
    ...(values.status === undefined ? {} : { status: values.status }),
    ...(values.frozenRunId === undefined ? {} : { frozenRunId: values.frozenRunId }),
    ...(values.agentId === undefined ? {} : { agentId: values.agentId }),
    ...(values.frozenAt === undefined ? {} : { frozenAt: dateOf(values.frozenAt) }),
    ...(values.frozenReason === undefined ? {} : { frozenReason: values.frozenReason }),
    ...(values.stepKey === undefined ? {} : { stepKey: values.stepKey }),
    ...(values.stepTitle === undefined ? {} : { stepTitle: values.stepTitle }),
    ...(values.customerName === undefined ? {} : { customerName: values.customerName }),
    ...(values.workItemId === undefined ? {} : { workItemId: values.workItemId }),
    ...(values.episode === undefined ? {} : { episode: values.episode }),
    ...(values.failures === undefined ? {} : { failures: values.failures }),
    ...(values.heldBy === undefined ? {} : { heldBy: values.heldBy }),
    ...(values.releasedAt === undefined ? {} : { releasedAt: dateOf(values.releasedAt) }),
    ...(values.releasedBy === undefined ? {} : { releasedBy: values.releasedBy }),
    ...(values.releaseReason === undefined ? {} : { releaseReason: values.releaseReason }),
    ...(values.pending === undefined ? {} : { pending: { ...pendingJsonOfObject(values) } }),
})

/** The pending events of a write as the column keeps them. */
const pendingJsonOfObject = (values: FreezeValues): object => {
    const json = pendingJsonOf(values.pending ?? [])
    return typeof json === "object" && json !== null && !Array.isArray(json) ? json : { events: [] }
}

const whereOf = (workspaceId: string, lookup: FreezeLookup): FindOptionsWhere<ContactFreezeEntity> => {
    if ("key" in lookup) return { workspaceId, key: lookup.key }
    if ("frozenRunId" in lookup) return { workspaceId, frozenRunId: lookup.frozenRunId }
    if ("contactId" in lookup) return { workspaceId, contactId: lookup.contactId }
    return { workspaceId, id: lookup.id }
}

@Injectable()
/** The freezes on public.contact_freezes, on the primary connection or a caller's transaction. No raw SQL. */
export class TypeormContactFreezeStore implements ContactFreezeStore {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The first freeze the lookup finds, or null. */
    async find(workspaceId: string, lookup: FreezeLookup, manager?: EntityManager): Promise<LeadFreeze | null> {
        const row = await (manager ?? this.entityManager).findOne(ContactFreezeEntity, {
            where: whereOf(workspaceId, lookup),
            order: { createdAt: "ASC", id: "ASC" },
        })
        return row === null ? null : freezeOf(row)
    }

    /** The freezes in one status, oldest freeze first, at most `limit`. */
    async inStatus(workspaceId: string, status: FreezeStatus, limit: number): Promise<ReadonlyArray<LeadFreeze>> {
        const rows = await this.entityManager.find(ContactFreezeEntity, {
            where: { workspaceId, status },
            order: { frozenAt: "ASC", id: "ASC" },
            take: limit,
        })
        return rows.map((item) => freezeOf(item))
    }

    /** Writes a new freeze of the subject with `values`; null when the subject's key holds one already (nothing written). */
    async insert(workspaceId: string, subject: FreezeSubject, values: FreezeValues): Promise<LeadFreeze | null> {
        const inserted = await this.entityManager
            .createQueryBuilder(ContactFreezeEntity, "freeze")
            .insert()
            .values({
                workspaceId,
                ...columnsOf(values),
                key: subject.key,
                contactId: subject.contactId,
                conversationId: subject.conversationId,
            })
            .orIgnore()
            .returning(["id"])
            .execute()
        // Postgres answers the inserted rows: none when the person's key held a freeze already.
        const returned: unknown = inserted.raw
        if (!Array.isArray(returned) || returned.length === 0) return null
        return this.find(workspaceId, { key: subject.key })
    }

    /** Writes members of a freeze at the version read; null when another write moved it first or it is gone (nothing written). */
    async update(
        workspaceId: string,
        id: string,
        expected: string,
        values: FreezeValues,
        manager?: EntityManager,
    ): Promise<LeadFreeze | null> {
        const result = await (manager ?? this.entityManager).update(
            ContactFreezeEntity,
            { workspaceId, id, version: Number(expected) },
            { ...columnsOf(values), version: () => "version + 1" },
        )
        return (result.affected ?? 0) > 0 ? this.find(workspaceId, { id }, manager) : null
    }
}
