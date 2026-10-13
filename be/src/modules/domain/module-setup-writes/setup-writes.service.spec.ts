import { fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { CardClosing, FactCardRecord, ProposedCardRecord } from "./module-setup-writes.contracts"
import { CLOSE_CARD, FIND_CARD, INSERT_CARDS, LIST_CARDS, SUPERSEDE_CARDS } from "./persistence/module-setup-writes.sql"
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
        const em = mockEntityManager({ query: [LIST_CARDS, [card]] })

        await expect((await build(em)).ofSessions(["ses-1", "ses-2"])).resolves.toEqual([card])

        expect(em.query).toHaveBeenCalledWith(LIST_CARDS, [["ses-1", "ses-2"]])
    })

    it("lists nothing when no session was named", async () => {
        const em = mockEntityManager()

        await expect((await build(em)).ofSessions([])).resolves.toEqual([])

        expect(em.query).not.toHaveBeenCalled()
    })

    it("finds one card of the workspace", async () => {
        const em = mockEntityManager({ query: [FIND_CARD, [card]] })

        await expect((await build(em)).find("ws-1", "card-1")).resolves.toEqual(card)

        expect(em.query).toHaveBeenCalledWith(FIND_CARD, ["card-1", "ws-1"])
    })

    it("answers nothing when the card is not in the workspace", async () => {
        const em = mockEntityManager({ query: [FIND_CARD, []] })

        await expect((await build(em)).find("ws-1", "missing")).resolves.toBeNull()
    })

    it("supersedes the waiting cards of the same targets and stores the new ones", async () => {
        const tx = fakeTransaction(
            mockEntityManager({
                query: [
                    [SUPERSEDE_CARDS, []],
                    [INSERT_CARDS, []],
                ],
            }),
        )
        const cards = [proposed, rule]

        await expect((await build(tx.em)).propose("ws-1", "ses-1", "msg-1", cards)).resolves.toBeUndefined()

        expect(tx.commits).toBe(1)
        expect(tx.em.query).toHaveBeenNthCalledWith(1, SUPERSEDE_CARDS, ["ses-1", ["fact:city", "rule:send_quote"]])
        expect(tx.em.query).toHaveBeenNthCalledWith(2, INSERT_CARDS, ["ws-1", "ses-1", "msg-1", JSON.stringify(cards)])
    })

    it("stores nothing when a turn proposed no card", async () => {
        const em = mockEntityManager()

        await expect((await build(em)).propose("ws-1", "ses-1", "msg-1", [])).resolves.toBeUndefined()

        expect(em.query).not.toHaveBeenCalled()
        expect(em.transaction).not.toHaveBeenCalled()
    })

    it("closes a waiting card", async () => {
        const closed: FactCardRecord = { ...card, status: "applied", result: closing.result, decidedBy: "Lan" }
        const em = mockEntityManager({ query: [CLOSE_CARD, [closed]] })

        await expect((await build(em)).close("ws-1", "card-1", closing)).resolves.toEqual(closed)

        expect(em.query).toHaveBeenCalledWith(CLOSE_CARD, [
            "card-1",
            "ws-1",
            "applied",
            JSON.stringify(payload),
            JSON.stringify(closing.result),
            "Lan",
        ])
    })

    it("answers nothing when the card was decided already", async () => {
        const em = mockEntityManager({ query: [CLOSE_CARD, []] })

        await expect((await build(em)).close("ws-1", "card-1", { ...closing, status: "rejected" })).resolves.toBeNull()
    })
})
