import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { EmailMessagesLedgerService } from "./email-messages-ledger.service"
import { EmailMessageEntity } from "./persistence/entities"

describe("EmailMessagesLedgerService", () => {
    describe("remindedInvoiceIds", () => {
        it("lists the distinct invoice ids of the reminders sent or waiting since the instant, bounded", async () => {
            const em = mockEntityManager()
            const fakes = queueQueryBuilders(em, [{ getRawMany: [{ invoiceId: "i-1" }, { invoiceId: null }] }])
            const moduleRef = await Test.createTestingModule({
                providers: [EmailMessagesLedgerService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
            }).compile()
            const since = new Date("2026-10-02T00:00:00Z")

            await expect(
                moduleRef.get(EmailMessagesLedgerService).remindedInvoiceIds("ws-1", since, 500),
            ).resolves.toEqual(["i-1", null])

            expect(em.createQueryBuilder).toHaveBeenCalledWith(EmailMessageEntity, "e")
            expect(fakes[0]?.callsOf("where")[0]?.[1]).toEqual({ workspaceId: "ws-1", since })
            expect(fakes[0]?.callsOf("distinct")).toEqual([[true]])
            expect(fakes[0]?.callsOf("limit")).toEqual([[500]])
        })
    })
})
