import { Test } from "@nestjs/testing"
import { fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { TypeormContactsStore } from "./contacts-store.typeorm"
import { ContactEntity, ContactIdentityEntity, ContactMergeEntity } from "./persistence/entities"

const WS = "11111111-1111-4111-8111-111111111111"

const build = async (manager: MockEntityManager) => {
    const tx = fakeTransaction(manager)
    const moduleRef = await Test.createTestingModule({
        providers: [TypeormContactsStore, { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em }],
    }).compile()
    return { store: moduleRef.get(TypeormContactsStore), em: tx.em }
}

describe("TypeormContactsStore reads by id", () => {
    it("reads at most one contact per id asked, and nothing for no id", async () => {
        const { store, em } = await build(mockEntityManager({ find: [ContactEntity, []] }))

        await store.transaction((work) => work.contactsOf(WS, ["a", "b", "c"]))
        await expect(store.transaction((work) => work.contactsOf(WS, []))).resolves.toEqual([])

        expect(em.find).toHaveBeenCalledTimes(1)
        expect(em.find).toHaveBeenCalledWith(ContactEntity, expect.objectContaining({ take: 3 }))
    })

    it("reads at most one redirect per merged contact asked", async () => {
        const { store, em } = await build(mockEntityManager({ find: [ContactMergeEntity, []] }))

        await store.transaction((work) => work.redirectsOf(WS, ["a", "b"]))

        expect(em.find).toHaveBeenCalledWith(ContactMergeEntity, expect.objectContaining({ take: 2 }))
    })
})

describe("TypeormContactsStore counts", () => {
    it("counts the active contacts created in a half-open window of the workspace", async () => {
        const { store, em } = await build(mockEntityManager())
        em.count.mockResolvedValue(7)
        const from = new Date("2026-11-01T00:00:00.000Z")
        const to = new Date("2026-11-08T00:00:00.000Z")

        await expect(store.transaction((work) => work.countCreated(WS, from, to))).resolves.toBe(7)

        expect(em.count).toHaveBeenCalledWith(ContactEntity, expect.objectContaining({ where: expect.objectContaining({ workspaceId: WS, state: "active" }) }))
    })
})

describe("TypeormContactsStore soft delete (owner ruling R31): nothing is removed, the rows are marked and left out of reads", () => {
    const AT = new Date("2026-11-14T03:00:00.000Z")

    it("marks the contacts erased and every identity they hold in ONE transaction, with UPDATEs only: no statement deletes a row", async () => {
        const { store, em } = await build(mockEntityManager())
        em.update.mockResolvedValue({ affected: 2, raw: [], generatedMaps: [] })

        await expect(store.transaction((work) => work.eraseContacts(WS, ["a", "b"], AT))).resolves.toBe(2)

        expect(em.update).toHaveBeenCalledTimes(2)
        const [contacts, identities] = em.update.mock.calls
        expect(contacts?.[0]).toBe(ContactEntity)
        expect(JSON.stringify(contacts?.[1])).toContain('"workspaceId":"' + WS + '"')
        expect(contacts?.[2]).toEqual({ state: "erased", erasedAt: AT })
        expect(identities?.[0]).toBe(ContactIdentityEntity)
        expect(identities?.[2]).toEqual({ erasedAt: AT })
        expect(em.delete).not.toHaveBeenCalled()
        expect(em.remove).not.toHaveBeenCalled()
    })

    it("keeps the first mark: only rows not yet erased are written (erasedAt IS NULL), and no id means no statement", async () => {
        const { store, em } = await build(mockEntityManager())
        em.update.mockResolvedValue({ affected: 0, raw: [], generatedMaps: [] })

        await expect(store.transaction((work) => work.eraseContacts(WS, [], AT))).resolves.toBe(0)
        expect(em.update).not.toHaveBeenCalled()

        await store.transaction((work) => work.eraseContacts(WS, ["a"], AT))
        for (const call of em.update.mock.calls) expect(JSON.stringify(call[1])).toContain("isNull")
    })

    it("reads identities, and matches an exact key, only among the live ones (erasedAt IS NULL): a deleted contact's identities are never met", async () => {
        const { store, em } = await build(mockEntityManager({ find: [ContactIdentityEntity, []] }))

        await store.transaction((work) => work.identitiesOf(WS, ["a"]))
        await store.transaction((work) => work.matchesOf(WS, [{ kind: "channel", provider: "zalo", account: "z1", value: "u1" }]))

        for (const call of em.find.mock.calls.filter(([entity]) => entity === ContactIdentityEntity))
            expect(JSON.stringify(call[1])).toContain("isNull")
        expect(em.find.mock.calls.filter(([entity]) => entity === ContactIdentityEntity)).toHaveLength(2)
    })
})
