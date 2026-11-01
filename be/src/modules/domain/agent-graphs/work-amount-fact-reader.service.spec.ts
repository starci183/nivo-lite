import { Test } from "@nestjs/testing"
import { ORDER_AMOUNT, WorkAmountFactReaderService } from "./work-amount-fact-reader.service"

const SUBJECT = { type: "work", id: "item-1", workItemId: "item-1" }

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [WorkAmountFactReaderService] }).compile()
    return moduleRef.get(WorkAmountFactReaderService)
}

describe("WorkAmountFactReaderService", () => {
    it("declares the order amount and the amount of each action that holds a limit, all counted in dong", async () => {
        const reader = await build()

        expect(reader.facts.find((fact) => fact.key === ORDER_AMOUNT)).toMatchObject({ type: "number", unit: "vnd" })
        expect(reader.facts.map((fact) => fact.key)).toEqual(
            expect.arrayContaining(["confirm_order.amount_vnd", "send_quote.amount_vnd", "give_discount.amount_vnd"]),
        )
        expect(reader.facts.every((fact) => fact.unit === "vnd" && fact.labelKey.startsWith("agentGraphs.fact."))).toBe(
            true,
        )
    })

    it("reads the amount the work item proposes for every amount fact asked", async () => {
        const reader = await build()

        await expect(
            reader.read("ws-1", { ...SUBJECT, amountVnd: 7_200_000 }, [ORDER_AMOUNT, "confirm_order.amount_vnd"]),
        ).resolves.toEqual({ [ORDER_AMOUNT]: 7_200_000, "confirm_order.amount_vnd": 7_200_000 })
    })

    it("reads nothing when the work item names no amount, so the branch falls to its else", async () => {
        const reader = await build()

        await expect(reader.read("ws-1", { ...SUBJECT, amountVnd: null }, [ORDER_AMOUNT])).resolves.toEqual({})
        await expect(reader.read("ws-1", SUBJECT, [ORDER_AMOUNT])).resolves.toEqual({})
    })
})
