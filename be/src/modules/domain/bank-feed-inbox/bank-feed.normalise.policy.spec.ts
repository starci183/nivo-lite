import { Test } from "@nestjs/testing"
import { defineAccountDataType, schemaOf } from "@modules/domain/account-data"
import { BANK_FEED_DATA_TYPES } from "./bank-feed.data-types"
import {
    deliveryTypeOf as realDeliveryTypeOf,
    feedDeliveryRowsOf as realFeedDeliveryRowsOf,
    feedReceiptOf as realFeedReceiptOf,
    feedTransactionRowsOf as realFeedTransactionRowsOf,
} from "./bank-feed.normalise.policy"

const SUBJECT = Symbol("bank-feed.normalise.policy")

type Subject = {
    deliveryTypeOf: typeof realDeliveryTypeOf
    feedDeliveryRowsOf: typeof realFeedDeliveryRowsOf
    feedReceiptOf: typeof realFeedReceiptOf
    feedTransactionRowsOf: typeof realFeedTransactionRowsOf
}

const buildSubject = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    deliveryTypeOf: realDeliveryTypeOf,
                    feedDeliveryRowsOf: realFeedDeliveryRowsOf,
                    feedReceiptOf: realFeedReceiptOf,
                    feedTransactionRowsOf: realFeedTransactionRowsOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const CONNECTION = "0b8e6f4a-6c1e-4d47-9a51-1f3c2b7d9e10"
const doors = ["sepay-feed", "casso", "payos"] as const

/** A SePay transfer in, as the SePay door normalises it. */
const credit = {
    amount: 1000.4,
    content: "NIVO8F3K2",
    eventId: "sepay:9",
    fallbackBankName: "MBBank",
    account: "0123",
    payer: "An",
    bankRef: "FT9",
    occurredAt: "2026-11-05 14:02:37",
}
/** A transfer out with nothing optional. */
const debit = { amount: 50, content: "", eventId: "casso:3", fallbackBankName: "ACB", direction: "debit" as const }

const typeNamed = (name: string) => BANK_FEED_DATA_TYPES.find((def) => def.name === name)

/** Whether a value fits the declaration of its type; a type nobody declared fits nothing. */
const fitsDeclared = (type: string, value: object): boolean =>
    BANK_FEED_DATA_TYPES.filter((def) => def.name === type).some((def) => schemaOf(def).safeParse(value).success)

describe("bank-feed data types", () => {
    it("declares the six types, each passing defineAccountDataType again", () => {
        expect(BANK_FEED_DATA_TYPES.map((def) => def.name)).toEqual([
            "casso.delivery",
            "casso.transaction",
            "payos.delivery",
            "payos.transaction",
            "sepay.delivery",
            "sepay.transaction",
        ])
        BANK_FEED_DATA_TYPES.forEach((def) => expect(defineAccountDataType(def)).toEqual(def))
    })

    it.each(doors)("normalises a %s delivery to a value its declaration accepts", async (door) => {
        const { deliveryTypeOf, feedDeliveryRowsOf } = await buildSubject()
        const rows = feedDeliveryRowsOf(door, "sepay:9", { connection: CONNECTION, credits: [credit, debit] })
        expect(rows.map((row) => row.type)).toEqual([deliveryTypeOf(door)])
        rows.forEach((row) =>
            expect(fitsDeclared(row.type, row.value)).toBe(true),
        )
    })

    it.each(doors)("normalises the %s movements to values their declaration accepts", async (door) => {
        const { feedTransactionRowsOf } = await buildSubject()
        const rows = feedTransactionRowsOf(door, { connection: CONNECTION, credits: [credit, debit], source: "poll" })
        expect(rows).toHaveLength(2)
        rows.forEach((row) => {
            const def = typeNamed(row.type)
            expect(def?.name.endsWith(".transaction")).toBe(true)
            expect(fitsDeclared(row.type, row.value)).toBe(true)
        })
    })
})

describe("bank-feed normalisers", () => {
    it("keeps each movement under the provider's own id, the amount whole and the time as ISO text", async () => {
        const { feedTransactionRowsOf } = await buildSubject()
        expect(feedTransactionRowsOf("sepay-feed", { connection: CONNECTION, credits: [credit, debit] })).toEqual([
            {
                type: "sepay.transaction",
                value: {
                    transactionId: "sepay:9",
                    amount: 1000,
                    direction: "credit",
                    content: "NIVO8F3K2",
                    account: "0123",
                    payer: "An",
                    bankRef: "FT9",
                    at: new Date("2026-11-05 14:02:37").toISOString(),
                    source: "webhook",
                },
            },
            {
                type: "sepay.transaction",
                value: { transactionId: "casso:3", amount: 50, direction: "debit", content: "", source: "webhook" },
            },
        ])
    })

    it("leaves out a time the bank did not say validly", async () => {
        const { feedTransactionRowsOf } = await buildSubject()
        const [row] = feedTransactionRowsOf("payos", {
            connection: CONNECTION,
            credits: [{ ...debit, occurredAt: "not a time" }],
        })
        expect(row?.value).not.toHaveProperty("at")
    })

    it("reads a stored delivery back in the consumer's shape, leaving out what booking cannot read", async () => {
        const { feedReceiptOf } = await buildSubject()
        expect(
            feedReceiptOf(CONNECTION, { deliveryId: "x", credits: [credit, { amount: "5" }, null], source: "poll" }),
        ).toEqual({ connection: CONNECTION, credits: [credit], source: "poll" })
        expect(feedReceiptOf(CONNECTION, { deliveryId: "x" })).toEqual({ connection: CONNECTION, credits: [] })
    })

    it("stores a credit with only the members it has", async () => {
        const { feedDeliveryRowsOf } = await buildSubject()
        const [row] = feedDeliveryRowsOf("casso", "abc", {
            connection: CONNECTION,
            credits: [debit],
        })
        expect(row?.value).toEqual({ deliveryId: "abc", credits: [debit] })
    })
})
