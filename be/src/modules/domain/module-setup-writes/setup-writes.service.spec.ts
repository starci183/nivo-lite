import { fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { In, Not } from "typeorm"
import {
    ANY_FUNCTION,
    answerQueryBuilders,
    fakeQueryBuilder,
} from "@tests/fixtures/builders/fake-query-builder.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { CardClosing, FactCardRecord, ProposedCardRecord } from "./module-setup-writes.contracts"
import { ModuleSetupWriteEntity } from "./persistence/entities"
import { SetupWritesService } from "./setup-writes.service"

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

const rule: ProposedCardRecord = {
    gate_key: "authority",
    kind: "rule",
    target_key: "rule:send_quote",
    payload: { action: "send_quote", field: "mode", mode: "ask", limitVnd: null },
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
            where: { setupSessionId: In(["ses-1", "ses-2"]), status: Not("superseded") },
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
            where: { id: "card-1", workspaceId: "ws-1" },
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
        const cards = [proposed, rule]

        await expect((await build(tx.em)).propose("ws-1", "ses-1", "msg-1", cards)).resolves.toBeUndefined()

        expect(tx.commits).toBe(1)
        expect(tx.em.update).toHaveBeenCalledWith(
            ModuleSetupWriteEntity,
            { setupSessionId: "ses-1", targetKey: In(["fact:city", "rule:send_quote"]), status: "proposed" },
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
            {
                workspaceId: "ws-1",
                setupSessionId: "ses-1",
                sourceMessageId: "msg-1",
                gateKey: "authority",
                kind: "rule",
                targetKey: "rule:send_quote",
                payload: rule.payload,
            },
        ])
        expect(tx.committedWrites.map((write) => write.method)).toEqual(["update", "insert"])
    })

    it("stores nothing when a turn proposed no card", async () => {
        const em = mockEntityManager()

        await expect((await build(em)).propose("ws-1", "ses-1", "msg-1", [])).resolves.toBeUndefined()

        expect(em.insert).not.toHaveBeenCalled()
        expect(em.transaction).not.toHaveBeenCalled()
    })
})

describe("SetupWritesService", () => {
    it("closes a waiting card", async () => {
        const closed: FactCardRecord = { ...card, status: "applied", result: closing.result, decidedBy: "Lan" }
        const em = mockEntityManager()
        const update = fakeQueryBuilder({
            execute: {
                raw: [
                    {
                        id: "card-1",
                        workspace_id: "ws-1",
                        setup_session_id: "ses-1",
                        source_message_id: "msg-1",
                        gate_key: "facts",
                        kind: "fact",
                        target_key: "fact:city",
                        payload,
                        status: "applied",
                        result: closing.result,
                        decided_by: "Lan",
                        created_at: new Date(card.createdAt),
                    },
                ],
            },
        })
        answerQueryBuilders(em, update)

        await expect((await build(em)).close("ws-1", "card-1", closing)).resolves.toEqual(closed)

        expect(update.argsOf("set")).toEqual([
            [
                {
                    status: "applied",
                    payload,
                    result: closing.result,
                    decidedBy: "Lan",
                    decidedAt: ANY_FUNCTION,
                },
            ],
        ])
        expect(update.argsOf("where")).toEqual([[{ id: "card-1", workspaceId: "ws-1", status: "proposed" }]])
    })

    it("answers nothing when the card was decided already", async () => {
        const em = mockEntityManager()
        answerQueryBuilders(em, fakeQueryBuilder({ execute: { raw: [] } }))

        await expect((await build(em)).close("ws-1", "card-1", { ...closing, status: "rejected" })).resolves.toBeNull()
    })
})
