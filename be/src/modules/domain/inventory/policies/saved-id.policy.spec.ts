import { Test } from "@nestjs/testing"
import { InventoryError, InventoryErrorCode } from "../errors/inventory.error"
import { idColumn, savedId } from "./saved-id.policy"
import type { IdRow } from "./saved-id.policy"

const SUBJECT = Symbol("saved-id.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { idColumn, savedId } }],
    }).compile()
    return moduleRef.get<typeof import("./saved-id.policy")>(SUBJECT)
}

describe("savedId", () => {
    it("resolves the id of the first saved row", async () => {
        const subject = await buildSubject()

        await expect(
            subject.savedId(Promise.resolve([{ id: "item-1" }, { id: "item-2" }]), InventoryErrorCode.ItemNotFound),
        ).resolves.toBe("item-1")
    })

    it("preserves an empty string id", async () => {
        const subject = await buildSubject()

        await expect(subject.savedId(Promise.resolve([{ id: "" }]), InventoryErrorCode.ItemNotFound)).resolves.toBe("")
    })

    it.each<{ name: string; rows: ReadonlyArray<IdRow>; code: InventoryErrorCode }>([
        { name: "null", rows: [{ id: null }], code: InventoryErrorCode.ItemNotFound },
        { name: "a missing row", rows: [], code: InventoryErrorCode.LocationNotFound },
    ])("throws InventoryError with the given code for $name id", async ({ rows, code }) => {
        const subject = await buildSubject()

        const result = subject.savedId(Promise.resolve(rows), code)

        await expect(result).rejects.toBeInstanceOf(InventoryError)
        await expect(result).rejects.toMatchObject({ code, params: {} })
    })
})

describe("idColumn", () => {
    it("renames the column named after the function to id", async () => {
        const subject = await buildSubject()

        await expect(
            subject.idColumn(Promise.resolve([{ inventory_save_item: "item-1" }]), "inventory_save_item"),
        ).resolves.toEqual([{ id: "item-1" }])
    })

    it("answers a null id for a null or missing column and nothing for no rows", async () => {
        const subject = await buildSubject()

        await expect(
            subject.idColumn(Promise.resolve([{ inventory_save_item: null }, {}]), "inventory_save_item"),
        ).resolves.toEqual([{ id: null }, { id: null }])
        await expect(subject.idColumn(Promise.resolve([]), "inventory_save_item")).resolves.toEqual([])
    })
})
