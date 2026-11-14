import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import { RecordEntity, RecordLinkEntity } from "../persistence/entities"
import { EntityEngineErrorCode } from "../errors/entity-engine.error"
import { deleteRecord, deleteRecords } from "./delete-record.policy"
import { mintScopedTx } from "./scoped-tx.policy"

const DELETE_RECORD = Symbol("delete-record.policy")

interface DeleteRecordPolicy {
    readonly deleteRecord: typeof deleteRecord
    readonly deleteRecords: typeof deleteRecords
}

const buildPolicy = async (): Promise<DeleteRecordPolicy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: DELETE_RECORD, useFactory: (): DeleteRecordPolicy => ({ deleteRecord, deleteRecords }) }],
    }).compile()
    return moduleRef.get<DeleteRecordPolicy>(DELETE_RECORD)
}

const WS = "11111111-1111-4111-8111-111111111111"
const AT = new Date("2026-11-13T00:00:00.000Z")

/** A chat (deletable) its lines point at with a cascade ref, its tags with a clear ref, its stars with a restrict ref. */
const typeOf = (
    name: `${string}.${string}`,
    relations?: EntityDefinition["relations"],
    deletable?: true,
): EntityDefinition => ({
    entry: "entity",
    name,
    dataKind: name,
    fields: {},
    ...(relations === undefined ? {} : { relations }),
    ...(deletable === undefined ? {} : { deletable }),
})

const CHAT = typeOf("blocks-core.chatbot.chat", undefined, true)
const LINE = typeOf("blocks-core.chatbot.message", {
    chat: { kind: "toOne", target: CHAT.name, required: true, onDelete: "cascade" },
})
const TAG = typeOf("blocks-core.chatbot.tag", { chat: { kind: "toOne", target: CHAT.name, onDelete: "clear" } })
const STAR = typeOf("blocks-core.chatbot.star", { line: { kind: "toOne", target: LINE.name } })

const catalogOf = (...entities: ReadonlyArray<EntityDefinition>) =>
    new Map(entities.map((entity) => [entity.name, entity]))

const linkOf = (
    fromEntity: string,
    fromId: string,
    relation: string,
    toEntity: string,
    toId: string,
): RecordLinkEntity =>
    Object.assign(new RecordLinkEntity(), { workspaceId: WS, fromEntity, fromId, relation, toEntity, toId })

/** The one statement of a soft delete (live links are counted by builders before it). */
const removal = (id: string) => [{ execute: { raw: [{ id }] } }]

const IS_NULL: unknown = expect.objectContaining({ _type: "isNull" })

describe("deleting the target of a ref applies the ref's onDelete (every delete is SOFT)", () => {
    it("cascade: soft-deletes the records that point at it too (live links only), in the same transaction, removing nothing", async () => {
        const policy = await buildPolicy()
        const em = mockEntityManager()
        const [pointing, chat, line] = queueQueryBuilders(em, [
            { getMany: [linkOf(LINE.name, "m-1", "chat", CHAT.name, "c-1")] },
            ...removal("c-1"),
            ...removal("m-1"),
        ])

        await expect(
            policy.deleteRecord(mintScopedTx({ manager: em, workspaceId: WS }), catalogOf(CHAT, LINE), CHAT.name, "c-1"),
        ).resolves.toEqual({
            kind: "ok",
        })
        expect(pointing?.callsOf("where")).toEqual([
            [
                "k.workspaceId = :ws AND k.fromEntity = :from AND k.relation = :relation AND k.toEntity = :toEntity AND k.toId = :toId",
                { ws: WS, from: LINE.name, relation: "chat", toEntity: CHAT.name, toId: "c-1" },
            ],
        ])
        expect(chat?.callsOf("where")).toEqual([
            [{ entity: CHAT.name, id: "c-1", workspaceId: WS, deletedAt: IS_NULL }],
        ])
        expect(line?.callsOf("where")).toEqual([
            [{ entity: LINE.name, id: "m-1", workspaceId: WS, deletedAt: IS_NULL }],
        ])
        expect(chat?.callsOf("delete")).toEqual([])
        expect(line?.callsOf("delete")).toEqual([])
        expect(em.delete).not.toHaveBeenCalled()
    })

    it("clear: the record that pointed at it stays and no link is removed (its link is hidden with the deleted target)", async () => {
        const policy = await buildPolicy()
        const em = mockEntityManager()
        const [record] = queueQueryBuilders(em, removal("c-1"))

        await expect(
            policy.deleteRecord(mintScopedTx({ manager: em, workspaceId: WS }), catalogOf(CHAT, TAG), CHAT.name, "c-1"),
        ).resolves.toEqual({
            kind: "ok",
        })
        expect(em.createQueryBuilder).toHaveBeenCalledTimes(1)
        expect(record?.callsOf("update")).toEqual([[RecordEntity]])
        expect(record?.callsOf("where")).toEqual([
            [{ entity: CHAT.name, id: "c-1", workspaceId: WS, deletedAt: IS_NULL }],
        ])
        expect(em.delete).not.toHaveBeenCalled()
    })

    it("restrict: a restrict ref from a live record to a cascaded record refuses the whole delete before anything is written", async () => {
        const policy = await buildPolicy()
        const em = mockEntityManager()
        const [, restricting] = queueQueryBuilders(em, [
            { getMany: [linkOf(LINE.name, "m-1", "chat", CHAT.name, "c-1")] },
            { getCount: 1 },
        ])

        await expect(
            policy.deleteRecord(mintScopedTx({ manager: em, workspaceId: WS }), catalogOf(CHAT, LINE, STAR), CHAT.name, "c-1"),
        ).resolves.toEqual({ kind: "blocked", relation: "line" })
        expect(restricting?.callsOf("where")).toEqual([
            [
                "k.workspaceId = :ws AND k.fromEntity = :from AND k.relation = :relation AND k.toEntity = :toEntity AND k.toId = :toId",
                { ws: WS, from: STAR.name, relation: "line", toEntity: LINE.name, toId: "m-1" },
            ],
        ])
        // Two read builders (the pointing links, the restricting links) and no statement that writes.
        expect(em.createQueryBuilder).toHaveBeenCalledTimes(2)
    })
})

describe("deleting by force, as the contact erase does", () => {
    it("force (the contact erase) deletes a type that does not declare deletable, and answers the rows it soft-deleted", async () => {
        const policy = await buildPolicy()
        const stored = Object.assign(new RecordEntity(), {
            entity: LINE.name,
            id: "m-1",
            workspaceId: WS,
            version: "1",
            createdAt: AT,
            updatedAt: AT,
            data: { text: "hi" },
        })
        const em = mockEntityManager({ findOne: [RecordEntity, stored] })
        queueQueryBuilders(em, removal("m-1"))
        const tx = mintScopedTx({ manager: em, workspaceId: WS })

        await expect(policy.deleteRecords(tx, catalogOf(LINE), [{ entity: LINE.name, id: "m-1" }])).rejects.toMatchObject({
            code: EntityEngineErrorCode.NotDeletable,
        })
        await expect(
            policy.deleteRecords(tx, catalogOf(LINE), [{ entity: LINE.name, id: "m-1" }], { force: true, rows: true }),
        ).resolves.toEqual({
            kind: "ok",
            removed: [
                {
                    entity: LINE.name,
                    id: "m-1",
                    row: {
                        id: "m-1",
                        workspaceId: WS,
                        version: "1",
                        createdAt: AT.toISOString(),
                        updatedAt: AT.toISOString(),
                        data: { text: "hi" },
                    },
                },
            ],
        })
    })
})
