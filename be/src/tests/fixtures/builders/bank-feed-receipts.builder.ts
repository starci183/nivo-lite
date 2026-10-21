import { createHash } from "node:crypto"

const raw = (body: object): Buffer => Buffer.from(JSON.stringify(body))

/** The clock instant used while consuming committed receipt fixtures. */
export const DEFERRED_AT = "2026-10-12T10:00:00.000Z"
const deferredCredit = { amount: 125000, content: "NIVO123", eventId: "bank:7", fallbackBankName: "Bank" }
/** A committed provider receipt with one credit ready for booking. */
export const receipt = { id: "receipt-1", payload: { connection: "c-1", credits: [deferredCredit] } }
/** The provider kinds whose receipts share the deferred booking workflow. */
export const providers = ["casso", "payos", "sepay-feed"] as const

/** Builds the three provider receipt identities and expected credits. */
export const receiptCasesOf = (tx1: object, incoming: object) => [
    {
        provider: "casso" as const,
        body: { error: 0, data: tx1 },
        deliveryId: `conn-1:${createHash("sha256")
            .update(Buffer.from(JSON.stringify({ error: 0, data: tx1 })))
            .digest("hex")}`,
        credits: [{ amount: 150000, content: "NIVO8F3K2", eventId: "casso:7", fallbackBankName: "ACB" }],
    },
    {
        provider: "payos" as const,
        body: { code: "00", data: { amount: 10, reference: "REF1" } },
        deliveryId: "conn-1:payos:REF1",
        credits: [{ amount: 10, content: "", eventId: "payos:REF1", fallbackBankName: "payOS" }],
    },
    {
        provider: "sepay-feed" as const,
        body: incoming,
        deliveryId: "conn-1:sepay:321",
        credits: [{ amount: 99000, content: "NIVO8F3K2 thanh toan", eventId: "sepay:321", fallbackBankName: "MBBank" }],
    },
]

/** The fixed clock instant for bank-feed intake scenarios. */
export const NOW = "2026-10-12T10:00:00.000Z"
/** A Casso transaction carrying a workspace payment reference. */
export const tx1 = { id: 7, amount: 150000, description: " NIVO8F3K2 ", bankName: "ACB" }

/** A SePay incoming transfer with explicit content and bank identity. */
export const incoming = {
    id: 321,
    transferType: "in",
    transferAmount: 99000,
    content: "NIVO8F3K2 thanh toan",
    gateway: "MBBank",
}

/** The credential and raw delivery used to prove the SePay feed boundary. */
export const feedDelivery = { connectionId: "conn-1", authorization: "Apikey k", rawBody: raw(incoming) }
