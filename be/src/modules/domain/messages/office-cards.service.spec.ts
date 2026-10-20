import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MessagesErrorCode } from "./errors/messages.error"
import type { OfficeCardPost } from "./office-cards.contracts"
import { OfficeCardsService } from "./office-cards.service"
import { INSERT_CARD_MESSAGE } from "./persistence/office-lines.sql"

const card = { v: 1, type: "booking_held", title: "Held a massage for 2 at 15:00" }

const line = (patch: Partial<OfficeCardPost> = {}): OfficeCardPost => ({
    room: null,
    agentId: "agent-1",
    authorName: "AI Sales",
    body: "  Held  ",
    leadId: "lead-1",
    workItemId: "wi-1",
    card,
    ...patch,
})

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [OfficeCardsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(OfficeCardsService)
}

describe("OfficeCardsService", () => {
    it("stores a valid card as the agent's line and answers where it landed", async () => {
        const em = mockEntityManager({ query: [INSERT_CARD_MESSAGE, [{ id: "m-1", room: "sales" }]] })
        const service = await build(em)

        await expect(service.post({ workspaceId: "ws-1" }, line())).resolves.toEqual({ id: "m-1", room: "sales" })

        expect(em.query).toHaveBeenCalledWith(INSERT_CARD_MESSAGE, [
            "ws-1",
            "agent",
            "AI Sales",
            "agent-1",
            "Held",
            "lead-1",
            "wi-1",
            null,
            JSON.stringify(card),
        ])
    })

    it("posts a NIVO line in the named room and falls back to the title for an empty preview", async () => {
        const em = mockEntityManager({ query: [INSERT_CARD_MESSAGE, []] })
        const service = await build(em)

        const posted = await service.post(
            { workspaceId: "ws-1" },
            line({ agentId: null, authorName: "NIVO", body: " ", room: "accounting" }),
        )

        expect(posted).toEqual({ id: "", room: "accounting" })
        expect(em.query).toHaveBeenCalledWith(INSERT_CARD_MESSAGE, [
            "ws-1",
            "system",
            "NIVO",
            null,
            card.title,
            "lead-1",
            "wi-1",
            "accounting",
            JSON.stringify(card),
        ])
    })

    it("refuses a card that breaks the contract and writes nothing", async () => {
        const em = mockEntityManager()
        const service = await build(em)

        await expect(service.post({ workspaceId: "ws-1" }, line({ card: { v: 1 } }))).rejects.toMatchObject({
            code: MessagesErrorCode.CardInvalid,
            params: { reason: "type is not a card type" },
        })
        expect(em.query).not.toHaveBeenCalled()
    })
})
