import { getMetadataArgsStorage } from "typeorm"
import { RecordEntity } from "./record.entity"

describe("RecordEntity: records are soft-deleted, never hard-deleted (owner order 2026-11-14)", () => {
    const columns = () => getMetadataArgsStorage().columns.filter((column) => column.target === RecordEntity)

    it("maps `deleted_at` as the entity's delete-date column, so every find, query builder and join over records leaves a deleted record out", () => {
        const deleted = columns().find((column) => column.propertyName === "deletedAt")
        expect(deleted?.mode).toBe("deleteDate")
        expect(deleted?.options).toMatchObject({ name: "deleted_at", type: "timestamptz", nullable: true })
    })

    it("has exactly one delete-date column", () => {
        expect(columns().filter((column) => column.mode === "deleteDate")).toHaveLength(1)
    })
})
