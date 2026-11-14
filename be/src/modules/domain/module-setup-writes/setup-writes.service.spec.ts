import { fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { In, Not } from "typeorm"
import { writeExpressionOf } from "@tests/fixtures/builders/write-expression.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { CardClosing, FactCardRecord, ProposedCardRecord } from "./module-setup-writes.contracts"
import { ModuleSetupWriteEntity } from "./persistence/entities"
import { SetupWritesService } from "./setup-writes.service"

/** Stands for the `() => "now()"` expression a write hands the database. */
const SQL_EXPRESSION: unknown = expect.any(Function)

const payload: FactCardRecord["payload"] = {
    subjectType: "business",
    subjectLabel: "shop",
    attributeLabel: "city",
    value: "Hue",
    scope: "public",
}

const card: FactCardRecord = {
    id: "card-1",
    workspaceId: "ws-1",
    setupSessionId: "ses-1",
    sourceMessageId: "msg-1",
    gateKey: "facts",
    targetKey: "fact:city",
    status: "proposed",
    result: null,
    decidedBy: null,
    createdAt: "2026-10-12T10:00:00.000Z",
    kind: "fact",
    payload,
}

const row = Object.assign(new ModuleSetupWriteEntity(), {
    ...card,
    decidedAt: null,
    createdAt: new Date(card.createdAt),
})

const proposed: ProposedCardRecord = {
    gate_key: "facts",
    kind: "fact",
    target_key: "fact:city",
    payload,
}

const closing: CardClosing = {
    status: "applied",
    payload,
    result: { outcome: "applied", factId: "fact-1" },
    decidedBy: "Lan",
}

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [SetupWritesService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(SetupWritesService)
}

describe("SetupWritesService", () => {
    it("lists the cards of the given sessions", async () => {
        const em = mockEntityManager({ find: [ModuleSetupWriteEntity, [row]] })

        await expect((await build(em)).ofSessions(["ses-1", "ses-2"])).resolves.toEqual([card])

        expect(em.find).toHaveBeenCalledWith(ModuleSetupWriteEntity, {
            where: { setupSessionId: In(["ses-1", "ses-2"]), kind: "fact", status: Not("superseded") },
            order: { createdAt: "ASC", id: "ASC" },
            take: 500,
        })
    })

    it("lists nothing when no session was named", async () => {
        const em = mockEntityManager()

        await expect((await build(em)).ofSessions([])).resolves.toEqual([])

        expect(em.find).not.toHaveBeenCalled()
    })

    it("finds one card of the workspace", async () => {
        const em = mockEntityManager({ findOne: [ModuleSetupWriteEntity, row] })

        await expect((await build(em)).find("ws-1", "card-1")).resolves.toEqual(card)

        expect(em.findOne).toHaveBeenCalledWith(ModuleSetupWriteEntity, {
            where: { id: "card-1", workspaceId: "ws-1", kind: "fact" },
        })
    })

    it("answers nothing when the card is not in the workspace", async () => {
        const em = mockEntityManager({ findOne: [ModuleSetupWriteEntity, null] })

        await expect((await build(em)).find("ws-1", "missing")).resolves.toBeNull()
    })
})

describe("SetupWritesService", () => {
    it("supersedes the waiting cards of the same targets and stores the new ones", async () => {
        const tx = fakeTransaction(
            mockEntityManager({
                update: [ModuleSetupWriteEntity, { affected: 0 }],
                insert: [ModuleSetupWriteEntity, {}],
            }),
        )
        const cards = [proposed]

        await expect((await build(tx.em)).propose("ws-1", "ses-1", "msg-1", cards)).resolves.toBeUndefined()

        expect(tx.commits).toBe(1)
        expect(tx.em.update).toHaveBeenCalledWith(
            ModuleSetupWriteEntity,
            { setupSessionId: "ses-1", sourceMessageId: "msg-1", status: "proposed" },
            { status: "superseded" },
        )
        expect(tx.em.update).toHaveBeenCalledWith(
            ModuleSetupWriteEntity,
            { setupSessionId: "ses-1", targetKey: In(["fact:city"]), status: "proposed" },
            { status: "superseded" },
        )
        expect(tx.em.insert).toHaveBeenCalledWith(ModuleSetupWriteEntity, [
            {
                workspaceId: "ws-1",
                setupSessionId: "ses-1",
                sourceMessageId: "msg-1",
                gateKey: "facts",
                kind: "fact",
                targetKey: "fact:city",
                payload,
            },
        ])
        expect(tx.committedWrites.map((write) => write.method)).toEqual(["update", "update", "insert"])
    })

    it("stores nothing but supersedes the cards of an earlier attempt when a turn proposed no card", async () => {
        const tx = fakeTransaction(mockEntityManager({ update: [ModuleSetupWriteEntity, { affected: 1 }] }))

        await expect((await build(tx.em)).propose("ws-1", "ses-1", "msg-1", [])).resolves.toBeUndefined()

        expect(tx.em.insert).not.toHaveBeenCalled()
        expect(tx.committedWrites.map((write) => write.method)).toEqual(["update"])
        expect(tx.em.update).toHaveBeenCalledWith(
            ModuleSetupWriteEntity,
            { setupSessionId: "ses-1", sourceMessageId: "msg-1", status: "proposed" },
            { status: "superseded" },
        )
    })
})

describe("SetupWritesService > close", () => {
    it("closes a waiting card", async () => {
        const closed: FactCardRecord = { ...card, status: "applied", result: closing.result, decidedBy: "Lan" }
        const em = mockEntityManager({
            update: [ModuleSetupWriteEntity, { affected: 1 }],
            findOne: [
                ModuleSetupWriteEntity,
                Object.assign(new ModuleSetupWriteEntity(), row, closed, { createdAt: row.createdAt }),
            ],
        })

        await expect((await build(em)).close("ws-1", "card-1", closing)).resolves.toEqual(closed)

        expect(em.update).toHaveBeenCalledWith(
            ModuleSetupWriteEntity,
            { id: "card-1", workspaceId: "ws-1", kind: "fact", status: "proposed" },
            { status: "applied", payload, result: closing.result, decidedBy: "Lan", decidedAt: SQL_EXPRESSION },
        )
        expect(writeExpressionOf(em.update.mock.calls[0]?.[2], "decidedAt")).toBe("now()")
    })

    it("answers nothing when the card was decided already", async () => {
        const em = mockEntityManager({ update: [ModuleSetupWriteEntity, {}] })

        await expect((await build(em)).close("ws-1", "card-1", { ...closing, status: "rejected" })).resolves.toBeNull()
    })

    it("answers nothing when the card vanished after the update", async () => {
        const em = mockEntityManager({
            update: [ModuleSetupWriteEntity, { affected: 1 }],
            findOne: [ModuleSetupWriteEntity, null],
        })

        await expect((await build(em)).close("ws-1", "card-1", closing)).resolves.toBeNull()
    })
})
