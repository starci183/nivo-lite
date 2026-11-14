import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { fakeTransaction } from "@starci/jest-preset"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { TypeormContactMemoryStore } from "./contact-memory-store.typeorm"
import { ContactEntity, ContactMemoryEntryEntity } from "./persistence/entities"

const WS = "11111111-1111-4111-8111-111111111111"

const build = async () => {
    const tx = fakeTransaction(mockEntityManager())
    const moduleRef = await Test.createTestingModule({
        providers: [TypeormContactMemoryStore, { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em }],
    }).compile()
    return { store: moduleRef.get(TypeormContactMemoryStore), em: tx.em }
}

describe("TypeormContactMemoryStore.entriesOf leaves out the memory of a deleted contact (soft delete, R31)", () => {
    it("joins the contact and keeps an entry of no contact or of a contact whose erased mark is empty; the rows themselves stay", async () => {
        const { store, em } = await build()
        const [fake] = queueQueryBuilders(em, [{ getMany: [] }])

        await expect(store.transaction((work) => work.entriesOf(WS, ["contact:c1", "conversation:v1"], 50))).resolves.toEqual([])

        expect(em.createQueryBuilder).toHaveBeenCalledWith(ContactMemoryEntryEntity, "entry")
        expect(fake?.callsOf("leftJoin")[0]).toEqual([ContactEntity, "contact", "contact.id = entry.contactId"])
        expect(fake?.callsOf("andWhere").map((call) => call[0])).toEqual([
            "entry.subjectKey IN (:...subjectKeys)",
            "(entry.contactId IS NULL OR contact.erasedAt IS NULL)",
        ])
        expect(fake?.callsOf("limit")[0]).toEqual([50])
        expect(em.delete).not.toHaveBeenCalled()
    })

    it("reads nothing, without a query, for no subject key", async () => {
        const { store, em } = await build()

        await expect(store.transaction((work) => work.entriesOf(WS, [], 50))).resolves.toEqual([])
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})
