import { Test } from "@nestjs/testing"
import { PROVIDER, TRIGGER } from "@nivo-lite/agent-sdk/names"
import { TRIGGERS } from "./trigger-specs.registry"
import { ENGINE_ROAD } from "./trigger-specs.contracts"
import { sourceStreamOf, streamOf, unknownStreamProviders } from "./trigger-streams.policy"

/**
 * STREAM IDENTITY (owner key `triggerOneSource2026_11_12`, CORRECTED 2026-11-12: one source per underlying stream): each provider adapter of
 * the trigger registry declares, as data, which of a connection's PUBLIC facts identify the stream its account reads, and the canonical
 * form each is compared in. Two accounts read the same stream exactly when their keys are EQUAL strings; a connection that stores none
 * of the facts is its own stream (`connection:<id>`), never matched to another.
 */

interface Subject {
    readonly streamOf: typeof streamOf
    readonly sourceStreamOf: typeof sourceStreamOf
}

const SUBJECT = Symbol("trigger-streams.policy")

const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { streamOf, sourceStreamOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("the stream a connection reads, per provider adapter", () => {
    it("a bank feed (SePay, Casso, PayOS): the bank code upper-case and the account number digits only, one key across providers", async () => {
        const { streamOf: of } = await build()
        const sepay = of(TRIGGER.paymentCreditReceived, PROVIDER.sepay, { bank_code: "vcb", account_number: "0123 456 789" })
        const casso = of(TRIGGER.paymentCreditReceived, PROVIDER.casso, { bank_code: " VCB ", account_number: "0123456789" })
        const payos = of(TRIGGER.paymentCreditReceived, PROVIDER.payos, { bank_code: "VCB", account_number: "0123-456-789" })
        expect(sepay).toBe("bank-account:VCB:0123456789")
        expect(casso).toBe(sepay)
        expect(payos).toBe(sepay)
        expect(of(TRIGGER.paymentCreditReceived, PROVIDER.casso, { bank_code: "VCB", account_number: "0123456780" })).not.toBe(sepay)
        expect(of(TRIGGER.paymentCreditReceived, PROVIDER.casso, { bank_code: "TCB", account_number: "0123456789" })).not.toBe(sepay)
        // The masked form people see is never an identity: without the full number the stream is unknown.
        expect(of(TRIGGER.paymentCreditReceived, PROVIDER.sepay, { bank_code: "VCB", account_masked: "•••• 6789" })).toBeNull()
        expect(of(TRIGGER.paymentCreditReceived, PROVIDER.sepay, { account_number: "0123456789" })).toBeNull()
    })

    it("a mailbox (IMAP): the address lower-case and trimmed", async () => {
        const { streamOf: of } = await build()
        expect(of(TRIGGER.mailMessageReceived, PROVIDER.imap, { email: " KeToan@Shop.vn " })).toBe("mailbox:ketoan@shop.vn")
        expect(of(TRIGGER.mailMessageReceived, PROVIDER.imap, { email: "cto@shop.vn" })).not.toBe(
            of(TRIGGER.mailMessageReceived, PROVIDER.imap, { email: "support@shop.vn" }),
        )
        expect(of(TRIGGER.mailMessageReceived, PROVIDER.imap, { email: "  " })).toBeNull()
    })

    it("a chat channel: the Zalo OA id, the Telegram bot id, the Facebook page id, the Instagram account id, each trimmed", async () => {
        const { streamOf: of } = await build()
        expect(of(TRIGGER.zaloMessageReceived, PROVIDER.zaloOa, { oa_id: " 4433 " })).toBe("zalo-oa:4433")
        expect(of(TRIGGER.telegramMessageReceived, PROVIDER.telegram, { bot_id: "777", bot_username: "shop_bot" })).toBe(
            "telegram-bot:777",
        )
        const meta = { page_id: "p-1", ig_id: "ig-9" }
        expect(of(TRIGGER.facebookMessageReceived, PROVIDER.meta, meta)).toBe("facebook-page:p-1")
        expect(of(TRIGGER.instagramMessageReceived, PROVIDER.meta, meta)).toBe("instagram-account:ig-9")
        expect(of(TRIGGER.instagramMessageReceived, PROVIDER.meta, { page_id: "p-1" })).toBeNull()
    })

    it("the engine's own roads and a provider that does not serve the verb read no stream", async () => {
        const { streamOf: of } = await build()
        expect(of(TRIGGER.clockTick, ENGINE_ROAD, {})).toBeNull()
        expect(of(TRIGGER.mailMessageReceived, PROVIDER.sepay, { bank_code: "VCB", account_number: "1" })).toBeNull()
    })

    it("an account whose stream is unknown is its OWN stream, keyed by the connection id", async () => {
        const { sourceStreamOf: of } = await build()
        expect(of(TRIGGER.mailMessageReceived, PROVIDER.imap, "conn-1", {})).toBe("connection:conn-1")
        expect(of(TRIGGER.mailMessageReceived, PROVIDER.imap, "conn-2", {})).not.toBe(
            of(TRIGGER.mailMessageReceived, PROVIDER.imap, "conn-1", {}),
        )
        expect(of(TRIGGER.mailMessageReceived, PROVIDER.imap, "conn-1", { email: "A@b.vn" })).toBe("mailbox:a@b.vn")
    })

    it("every provider adapter of the registry declares its stream: none is left unknown by design", () => {
        expect(unknownStreamProviders()).toEqual([])
        const declared = Object.values(TRIGGERS).flatMap((spec) =>
            spec.adapters.filter((adapter) => adapter.provider !== ENGINE_ROAD).map((adapter) => adapter.stream?.kind ?? null),
        )
        expect(declared).not.toContain(null)
    })
})
