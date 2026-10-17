import { createHmac } from "node:crypto"
import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { Secret } from "@modules/platform/config"
import { BILLING_OPTIONS } from "./billing.decorators"
import type { BillingOptions } from "./billing.options"
import { sha256Hex } from "./channel-secret.policy"
import { PaymentSecretsService } from "./payment-secrets.service"
import type { PaymentSecret } from "./payment-secrets.service"
import { BillingErrorCode } from "./errors/billing.error"
import { PaymentProofService } from "./payment-proof.service"

const CONNECTION_ID = "0b5d3f4e-1c2a-4b6d-8e7f-9a0b1c2d3e4f"
const REFUSED = expect.objectContaining({ code: BillingErrorCode.WebhookUnauthorized })
const INVALID = expect.objectContaining({ code: BillingErrorCode.WebhookInvalid })

const OPTIONS: BillingOptions = {
    sepayApiKey: new Secret("billing-key"),
    bankAccount: { account: "", bank: "", holder: "" },
    simulatedBank: { secret: new Secret("bank-secret"), workspaceId: "ws-1" },
    channelTokenKey: undefined,
}

const build = async (options: Partial<BillingOptions> = {}, loaded: PaymentSecret | null = null) => {
    const secrets = mock<PaymentSecretsService>()
    secrets.load.mockResolvedValue(loaded)
    const moduleRef = await Test.createTestingModule({
        providers: [
            PaymentProofService,
            { provide: BILLING_OPTIONS, useValue: builder<BillingOptions>(OPTIONS)(options) },
            { provide: PaymentSecretsService, useValue: secrets },
        ],
    }).compile()
    return { proof: moduleRef.get(PaymentProofService), secrets }
}

const secretOf = (credential: object | string, webhookSecret = "hook"): PaymentSecret => ({
    workspaceId: "ws-9",
    credential: typeof credential === "string" ? credential : JSON.stringify(credential),
    webhookSecret,
})
const rawOf = (body: object): Buffer => Buffer.from(JSON.stringify(body))

describe("PaymentProofService > verifyBillingKey", () => {
    it("lets the configured SePay key through and refuses anything else", async () => {
        const { proof } = await build()
        const { proof: unconfigured } = await build({ ...OPTIONS, sepayApiKey: undefined })

        expect(() => proof.verifyBillingKey("Apikey billing-key")).not.toThrow()
        expect(() => proof.verifyBillingKey("Apikey other")).toThrow(REFUSED)
        expect(() => proof.verifyBillingKey(undefined)).toThrow(REFUSED)
        expect(() => unconfigured.verifyBillingKey("Apikey billing-key")).toThrow(REFUSED)
    })
})

describe("PaymentProofService > verifySimulatedBank", () => {
    it("lets the configured secret through and refuses anything else", async () => {
        const { proof } = await build()
        const { proof: unconfigured } = await build({
            ...OPTIONS,
            simulatedBank: { secret: undefined, workspaceId: "ws-1" },
        })

        expect(() => proof.verifySimulatedBank("bank-secret")).not.toThrow()
        expect(() => proof.verifySimulatedBank("nope")).toThrow(REFUSED)
        expect(() => proof.verifySimulatedBank(undefined)).toThrow(REFUSED)
        expect(() => unconfigured.verifySimulatedBank("bank-secret")).toThrow(REFUSED)
    })
})

describe("PaymentProofService > proveCasso", () => {
    const body = { error: 0, data: { id: 5, amount: 1000, description: "NIVO8F3K2" } }
    const signed = (key: string): string =>
        "t=1700,v1=" +
        createHmac("sha512", key)
            .update('1700.{"data":{"amount":1000,"description":"NIVO8F3K2","id":5},"error":0}')
            .digest("hex")
    const delivery = (over: object = {}) => ({
        connectionId: CONNECTION_ID,
        rawBody: rawOf(body),
        signature: undefined,
        secureToken: undefined,
        ...over,
    })
    it("proves a V2 delivery signed with the integration key and answers the connection and the body", async () => {
        const { proof, secrets } = await build(OPTIONS, secretOf({ secureKey: "casso-key" }))

        await expect(proof.proveCasso(delivery({ signature: signed("casso-key") }))).resolves.toEqual({
            connection: { connectionId: CONNECTION_ID, workspaceId: "ws-9" },
            body,
        })
        expect(secrets.load).toHaveBeenCalledWith(CONNECTION_ID, "casso")
    })

    it("proves a V1 delivery that sends the key as its secure token", async () => {
        const { proof } = await build(OPTIONS, secretOf({ secureKey: "casso-key" }))

        await expect(proof.proveCasso(delivery({ secureToken: "casso-key" }))).resolves.toMatchObject({
            connection: { workspaceId: "ws-9" },
        })
    })

    it("refuses another key, a wrong token, a changed body and no proof at all", async () => {
        const { proof } = await build(OPTIONS, secretOf({ secureKey: "casso-key" }))
        const changed = rawOf({ ...body, error: 1 })

        await expect(proof.proveCasso(delivery({ signature: signed("other") }))).rejects.toEqual(REFUSED)
        await expect(proof.proveCasso(delivery({ secureToken: "nope" }))).rejects.toEqual(REFUSED)
        await expect(proof.proveCasso(delivery({ rawBody: changed, signature: signed("casso-key") }))).rejects.toEqual(
            REFUSED,
        )
        await expect(proof.proveCasso(delivery())).rejects.toEqual(REFUSED)
    })

    it("refuses an unknown connection and credentials without a usable key", async () => {
        const unknown = await build(OPTIONS, null)
        const noKey = await build(OPTIONS, secretOf({ other: "x" }))
        const notText = await build(OPTIONS, secretOf({ secureKey: 5 }))
        const notJson = await build(OPTIONS, secretOf("{broken"))
        const array = await build(OPTIONS, secretOf("[1]"))

        for (const { proof } of [unknown, noKey, notText, notJson, array]) {
            await expect(proof.proveCasso(delivery({ secureToken: "" }))).rejects.toEqual(REFUSED)
        }
    })

    it("refuses a body that is not a JSON object before looking up the connection", async () => {
        const { proof, secrets } = await build(OPTIONS, secretOf({ secureKey: "casso-key" }))

        await expect(proof.proveCasso(delivery({ rawBody: Buffer.from("nope") }))).rejects.toEqual(INVALID)
        expect(secrets.load).not.toHaveBeenCalled()
    })
})

describe("PaymentProofService > provePayos", () => {
    const data = { orderCode: 99, amount: 50000, description: "NIVO8F3K2", reference: "REF1" }
    const signatureOf = (key: string): string =>
        createHmac("sha256", key).update("amount=50000&description=NIVO8F3K2&orderCode=99&reference=REF1").digest("hex")
    const delivery = (body: object | undefined) => ({
        connectionId: CONNECTION_ID,
        rawBody: body === undefined ? undefined : rawOf(body),
    })
    it("proves a delivery signed with the checksum key", async () => {
        const { proof, secrets } = await build(OPTIONS, secretOf({ checksumKey: "payos-key" }))
        const body = { code: "00", data, signature: signatureOf("payos-key") }

        await expect(proof.provePayos(delivery(body))).resolves.toEqual({
            kind: "proven",
            connection: { connectionId: CONNECTION_ID, workspaceId: "ws-9" },
            body,
        })
        expect(secrets.load).toHaveBeenCalledWith(CONNECTION_ID, "payos")
    })

    it("recognises the confirmation ping before checking any signature", async () => {
        const { proof } = await build(OPTIONS, secretOf({ checksumKey: "payos-key" }))

        await expect(
            proof.provePayos(delivery({ code: "00", data: { orderCode: 123 }, signature: "unsigned" })),
        ).resolves.toEqual({ kind: "sample" })
    })

    it("refuses a wrong, missing or foreign signature", async () => {
        const { proof } = await build(OPTIONS, secretOf({ checksumKey: "payos-key" }))

        await expect(proof.provePayos(delivery({ code: "00", data, signature: "00" }))).rejects.toEqual(REFUSED)
        await expect(proof.provePayos(delivery({ code: "00", data }))).rejects.toEqual(REFUSED)
        await expect(proof.provePayos(delivery({ code: "00", data, signature: signatureOf("other") }))).rejects.toEqual(
            REFUSED,
        )
    })

    it("refuses an unknown connection, a delivery without data and a connection without a checksum key", async () => {
        const unknown = await build(OPTIONS, null)
        const noKey = await build(OPTIONS, secretOf({ secureKey: "x" }))
        const known = await build(OPTIONS, secretOf({ checksumKey: "payos-key" }))
        const signed = { code: "00", data, signature: signatureOf("payos-key") }

        await expect(unknown.proof.provePayos(delivery(signed))).rejects.toEqual(REFUSED)
        await expect(noKey.proof.provePayos(delivery(signed))).rejects.toEqual(REFUSED)
        await expect(known.proof.provePayos(delivery({ code: "00" }))).rejects.toEqual(REFUSED)
    })

    it("refuses a body that is not a JSON object", async () => {
        const { proof } = await build(OPTIONS, secretOf({ checksumKey: "payos-key" }))

        await expect(proof.provePayos(delivery(undefined))).rejects.toEqual(INVALID)
    })
})

describe("PaymentProofService > proveSepayFeed", () => {
    const raw = rawOf({ id: 3, transferType: "in", transferAmount: 1000 })
    const delivery = (authorization: string | undefined, rawBody: Buffer | undefined = raw) => ({
        connectionId: CONNECTION_ID,
        authorization,
        rawBody,
    })
    it("proves a delivery whose key hashes to the webhook secret of the connection", async () => {
        const { proof, secrets } = await build(OPTIONS, secretOf({}, sha256Hex("feed-key")))

        await expect(proof.proveSepayFeed(delivery("Apikey feed-key"))).resolves.toEqual({
            connection: { connectionId: CONNECTION_ID, workspaceId: "ws-9" },
            body: { id: 3, transferType: "in", transferAmount: 1000 },
        })
        expect(secrets.load).toHaveBeenCalledWith(CONNECTION_ID, "sepay")
    })

    it("refuses another key, an unknown connection and a header that is not an Apikey", async () => {
        const wrong = await build(OPTIONS, secretOf({}, sha256Hex("feed-key")))
        const unknown = await build(OPTIONS, null)

        await expect(wrong.proof.proveSepayFeed(delivery("Apikey other"))).rejects.toEqual(REFUSED)
        await expect(unknown.proof.proveSepayFeed(delivery("Apikey feed-key"))).rejects.toEqual(REFUSED)
        await expect(wrong.proof.proveSepayFeed(delivery("Bearer feed-key"))).rejects.toEqual(REFUSED)
        await expect(wrong.proof.proveSepayFeed(delivery(undefined))).rejects.toEqual(REFUSED)
        expect(wrong.secrets.load).toHaveBeenCalledTimes(1)
    })

    it("refuses a proven delivery whose body is not a JSON object", async () => {
        const { proof } = await build(OPTIONS, secretOf({}, sha256Hex("feed-key")))

        await expect(proof.proveSepayFeed(delivery("Apikey feed-key", Buffer.from("x")))).rejects.toEqual(INVALID)
    })
})
