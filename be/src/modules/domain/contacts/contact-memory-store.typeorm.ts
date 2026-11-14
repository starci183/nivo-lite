import { Injectable } from "@nestjs/common"
import { In, LessThan, type EntityManager } from "typeorm"
import type { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import type {
    ContactMemoryEntry,
    ContactMemoryStore,
    ContactMemoryTx,
    ContactMemoryValues,
    MemoryJson,
} from "./contact-memory-store.port"
import { ContactEntity, ContactMemoryEntryEntity } from "./persistence/entities"

const isJsonObject = (value: unknown): value is MemoryJson =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const jsonObjectOf = (value: unknown): MemoryJson =>
    isJsonObject(value) ? Object.fromEntries(Object.entries(value).map(([name, member]): [string, JsonValue] => [name, member])) : {}

const entryOfRow = (row: ContactMemoryEntryEntity): ContactMemoryEntry => ({
    id: row.id,
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
    entryKey: row.entryKey,
    subjectKey: row.subjectKey,
    contactId: row.contactId,
    conversationId: row.conversationId,
    namespace: row.namespace,
    nodeKey: row.nodeKey,
    step: row.step,
    kind: row.kind,
    agentId: row.agentId,
    workflowId: row.workflowId,
    runId: row.runId,
    versionId: row.versionId,
    output: jsonObjectOf(row.output),
    error: row.error === null ? null : jsonObjectOf(row.error),
    writtenAt: row.writtenAt.toISOString(),
    closedAt: row.closedAt === null ? null : row.closedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
})

/** The columns of the members a write sets. */
const columnsOf = (values: Partial<ContactMemoryValues>): QueryDeepPartialEntity<ContactMemoryEntryEntity> => ({
    ...(values.entryKey === undefined ? {} : { entryKey: values.entryKey }),
    ...(values.subjectKey === undefined ? {} : { subjectKey: values.subjectKey }),
    ...(values.contactId === undefined ? {} : { contactId: values.contactId }),
    ...(values.conversationId === undefined ? {} : { conversationId: values.conversationId }),
    ...(values.namespace === undefined ? {} : { namespace: values.namespace }),
    ...(values.nodeKey === undefined ? {} : { nodeKey: values.nodeKey }),
    ...(values.step === undefined ? {} : { step: values.step }),
    ...(values.kind === undefined ? {} : { kind: values.kind }),
    ...(values.agentId === undefined ? {} : { agentId: values.agentId }),
    ...(values.workflowId === undefined ? {} : { workflowId: values.workflowId }),
    ...(values.runId === undefined ? {} : { runId: values.runId }),
    ...(values.versionId === undefined ? {} : { versionId: values.versionId }),
    ...(values.output === undefined ? {} : { output: { ...values.output } }),
    ...(values.error === undefined ? {} : { error: values.error === null ? null : { ...values.error } }),
    ...(values.writtenAt === undefined ? {} : { writtenAt: new Date(values.writtenAt) }),
    ...(values.closedAt === undefined ? {} : { closedAt: values.closedAt === null ? null : new Date(values.closedAt) }),
    ...(values.expiresAt === undefined ? {} : { expiresAt: new Date(values.expiresAt) }),
})

/** The memory entries on public.contact_memory, in one transaction of the primary connection. No raw SQL. */
class TypeormContactMemoryTx implements ContactMemoryTx {
    constructor(private readonly tx: EntityManager) {}

    async entriesOf(
        workspaceId: string,
        subjectKeys: ReadonlyArray<string>,
        limit: number,
    ): Promise<ReadonlyArray<ContactMemoryEntry>> {
        if (subjectKeys.length === 0) return []
        // A deleted contact's entries stay in the table (soft delete, owner ruling R31) and are left out of this read: the join keeps an entry
        // of no contact (a person met only by a conversation) and an entry of a live one.
        const rows = await this.tx
            .createQueryBuilder(ContactMemoryEntryEntity, "entry")
            .leftJoin(ContactEntity, "contact", "contact.id = entry.contactId")
            .where("entry.workspaceId = :workspaceId", { workspaceId })
            .andWhere("entry.subjectKey IN (:...subjectKeys)", { subjectKeys: [...subjectKeys] })
            .andWhere("(entry.contactId IS NULL OR contact.erasedAt IS NULL)")
            .orderBy("entry.id", "ASC")
            .limit(limit)
            .getMany()
        return rows.map((row) => entryOfRow(row))
    }

    async entriesOfRunNode(
        workspaceId: string,
        runId: string,
        nodeKey: string,
        limit: number,
    ): Promise<ReadonlyArray<ContactMemoryEntry>> {
        const rows = await this.tx.find(ContactMemoryEntryEntity, {
            where: { workspaceId, runId, nodeKey },
            order: { id: "ASC" },
            take: limit,
        })
        return rows.map((row) => entryOfRow(row))
    }

    async entryOf(workspaceId: string, entryKey: string): Promise<ContactMemoryEntry | null> {
        const row = await this.tx.findOne(ContactMemoryEntryEntity, { where: { workspaceId, entryKey } })
        return row === null ? null : entryOfRow(row)
    }

    async put(workspaceId: string, values: ContactMemoryValues): Promise<void> {
        const inserted = await this.tx
            .createQueryBuilder(ContactMemoryEntryEntity, "entry")
            .insert()
            .values({ workspaceId, ...columnsOf(values) })
            .orIgnore()
            .returning(["id"])
            .execute()
        // Postgres answers the inserted rows: none when the key was held, so the held entry is written instead.
        const returned: unknown = inserted.raw
        if (Array.isArray(returned) && returned.length > 0) return
        await this.tx.update(
            ContactMemoryEntryEntity,
            { workspaceId, entryKey: values.entryKey },
            { ...columnsOf(values), version: () => "version + 1" },
        )
    }

    async update(workspaceId: string, id: string, expected: number, values: Partial<ContactMemoryValues>): Promise<boolean> {
        const result = await this.tx.update(
            ContactMemoryEntryEntity,
            { workspaceId, id, version: expected },
            { ...columnsOf(values), version: () => "version + 1" },
        )
        return (result.affected ?? 0) > 0
    }

    async remove(workspaceId: string, ids: ReadonlyArray<string>): Promise<void> {
        if (ids.length === 0) return
        await this.tx.delete(ContactMemoryEntryEntity, { workspaceId, id: In([...ids]) })
    }

    async dueBefore(workspaceId: string, now: Date, limit: number): Promise<ReadonlyArray<ContactMemoryEntry>> {
        const rows = await this.tx.find(ContactMemoryEntryEntity, {
            where: { workspaceId, expiresAt: LessThan(now) },
            order: { expiresAt: "ASC", id: "ASC" },
            take: limit,
        })
        return rows.map((row) => entryOfRow(row))
    }
}

@Injectable()
/** The contact memory store on the primary connection: every change in one transaction. */
export class TypeormContactMemoryStore implements ContactMemoryStore {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Runs `work` in one database transaction and hands it the transactional contact-memory view. */
    transaction<T>(work: (tx: ContactMemoryTx) => Promise<T>): Promise<T> {
        return this.entityManager.transaction((tx) => work(new TypeormContactMemoryTx(tx)))
    }
}
