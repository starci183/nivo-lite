import { PARTITION_NAME_MAX, partitionNameOf } from "./partition-name"

describe("partitionNameOf", () => {
    it("prefixes the name and turns dots and dashes into underscores", () => {
        expect(partitionNameOf("sales.lead")).toBe("records_sales_lead")
        expect(partitionNameOf("chat.thread-count")).toBe("records_chat_thread_count")
    })

    it("maps names that differ only in dots and dashes to one partition", () => {
        expect(partitionNameOf("a-b.c")).toBe(partitionNameOf("a.b-c"))
    })

    it("caps the name at 63 characters", () => {
        const name = partitionNameOf(`sales.${"x".repeat(100)}`)
        expect(name).toHaveLength(PARTITION_NAME_MAX)
        expect(name.startsWith("records_sales_xxx")).toBe(true)
    })
})
