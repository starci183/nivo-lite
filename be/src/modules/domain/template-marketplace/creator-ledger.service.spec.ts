import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { CREATOR } from "@tests/fixtures/builders/agent-template.builder"
import { CreatorLedgerService } from "./creator-ledger.service"
import { CreatorLedgerEntryEntity } from "./persistence/entities"

const line = (kind: "creator_share" | "platform_fee", amountVnd: number): CreatorLedgerEntryEntity =>
    Object.assign(new CreatorLedgerEntryEntity(), {
        id: `line-${kind}`,
        templateKey: "spa-booking-by-linh",
        orderId: "order-1",
        kind,
        amountVnd,
        createdAt: new Date("2026-11-03T02:30:00.000Z"),
    })

describe("CreatorLedgerService.mine", () => {
    it("lists the lines of the caller and totals only what the creator is owed, never the fee of the platform", async () => {
        const em = mockEntityManager({
            find: [
                CreatorLedgerEntryEntity,
                [line("creator_share", 693_000), line("platform_fee", 297_000), line("creator_share", 7_000)],
            ],
        })
        const moduleRef = await Test.createTestingModule({
            providers: [CreatorLedgerService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
        }).compile()

        const ledger = await moduleRef.get(CreatorLedgerService).mine(CREATOR.accountId)

        expect(ledger.owedVnd).toBe(700_000)
        expect(ledger.lines).toHaveLength(3)
        expect(ledger.lines[0]).toEqual({
            id: "line-creator_share",
            templateKey: "spa-booking-by-linh",
            orderId: "order-1",
            kind: "creator_share",
            amountVnd: 693_000,
            createdAt: "2026-11-03T02:30:00.000Z",
        })
        expect(em.find).toHaveBeenCalledWith(
            CreatorLedgerEntryEntity,
            expect.objectContaining({ where: { creatorAccountId: CREATOR.accountId } }),
        )
    })
})
