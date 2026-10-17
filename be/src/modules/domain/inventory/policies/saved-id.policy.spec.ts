import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { InventoryError, InventoryErrorCode } from "../errors/inventory.error"
import { SAVE_ITEM } from "../persistence/inventory.sql"
import { savedId } from "./saved-id.policy"
import type { IdRow } from "./saved-id.policy"

const SUBJECT = Symbol("saved-id.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { savedId } }],
    }).compile()
    return moduleRef.get<typeof import("./saved-id.policy")>(SUBJECT)
}

describe("savedId", () => {
    it("resolves the id of the first saved row", async () => {
        const subject = await buildSubject()

        const em = mockEntityManager({ query: [SAVE_ITEM, [{ id: "item-1" }, { id: "item-2" }]] })

        await expect(subject.savedId(em.query<Array<IdRow>>(SAVE_ITEM), InventoryErrorCode.ItemNotFound)).resolves.toBe(
            "item-1",
        )
    })

    it("preserves an empty string id", async () => {
        const subject = await buildSubject()

        await expect(subject.savedId(Promise.resolve([{ id: "" }]), InventoryErrorCode.ItemNotFound)).resolves.toBe("")
    })

    it.each([
        { name: "null", rows: [{ id: null }], code: InventoryErrorCode.ItemNotFound },
        { name: "undefined", rows: [{ id: undefined }], code: InventoryErrorCode.SupplierNotFound },
        { name: "missing", rows: [{}], code: InventoryErrorCode.RecipeNotFound },
        { name: "a missing row", rows: [], code: InventoryErrorCode.LocationNotFound },
    ])("throws InventoryError with the given code for $name id", async ({ rows, code }) => {
        const subject = await buildSubject()

        const em = mockEntityManager({ query: [SAVE_ITEM, rows] })
        const result = subject.savedId(em.query<Array<IdRow>>(SAVE_ITEM), code)

        await expect(result).rejects.toBeInstanceOf(InventoryError)
        await expect(result).rejects.toMatchObject({ code, params: {} })
    })
})
