import { ConnectionsError, ConnectionsErrorCode } from "@modules/domain/connections"
import { MANAGEMENT_CONNECTION_IDS, MANAGEMENT_SEED_SCHEMA } from "./management-seed.contracts"
import { readManagementSeed, readSeedDocuments } from "./management-seed.policy"

const refused = (field: string) =>
    new ConnectionsError({ code: ConnectionsErrorCode.CommandInvalid, params: { field } })

const SEPAY_KEY = ["nivo", "ab12".repeat(16)].join("_")
const SEPAY_API_TOKEN = ["api", "token", "1"].join("-")
const SEALED = {
    WORKSPACE_OWNER_EMAIL: "Owner@Nivo.test",
    WORKSPACE_SMTP_HOST: "smtp.nivo.test",
    WORKSPACE_SMTP_PORT: "587",
    WORKSPACE_SMTP_USER: "mailer",
    WORKSPACE_SMTP_PASSWORD: "mail-pass-1",
    WORKSPACE_SMTP_FROM: "No-Reply@Nivo.test",
    WORKSPACE_TELEGRAM_BOT_TOKEN: "telegram-token",
    WORKSPACE_ZALO_OA_APP_ID: "1234567",
    WORKSPACE_ZALO_OA_APP_SECRET: "app-secret-1",
    WORKSPACE_ZALO_OA_SECRET_KEY: "PENDING-until-issued",
    WORKSPACE_SEPAY_BANK_ACCOUNT: "0123456789",
    WORKSPACE_SEPAY_BANK_CODE: "VCB",
    WORKSPACE_SEPAY_ACCOUNT_HOLDER: "NIVO",
    WORKSPACE_SEPAY_API_KEY: SEPAY_KEY,
    WORKSPACE_SEPAY_API_TOKEN: SEPAY_API_TOKEN,
    WORKSPACE_PAYOS_CLIENT_ID: "client",
    WORKSPACE_PAYOS_API_KEY: "payos-key-1",
    WORKSPACE_PAYOS_CHECKSUM_KEY: "checksum-1",
    WORKSPACE_GOOGLE_OAUTH_CLIENT_ID: "client-id.apps.test",
    WORKSPACE_GOOGLE_OAUTH_CLIENT_SECRET: "client-secret-1",
}
const production = (values: Record<string, unknown> = SEALED) => ({
    schema: MANAGEMENT_SEED_SCHEMA,
    workspaceName: "NIVO",
    values,
})
/** The sealed values without the named ones. */
const without = (...names: ReadonlyArray<string>): Record<string, string> =>
    Object.fromEntries(Object.entries(SEALED).filter(([name]) => !names.includes(name)))
const dev = { schema: MANAGEMENT_SEED_SCHEMA, workspaceName: "NIVO", ownerEmail: " Dev-Owner@Nivo.test " }

describe("readManagementSeed > a production document", () => {
    it("reads the owner, the mail server and the four connections from the sealed values", () => {
        const seed = readManagementSeed(production())

        expect(seed.workspaceName).toBe("NIVO")
        expect(seed.ownerEmail).toBe("owner@nivo.test")
        expect(seed.smtp).toEqual({
            host: "smtp.nivo.test",
            port: 587,
            user: "mailer",
            password: "mail-pass-1",
            from: "no-reply@nivo.test",
        })
        expect(seed.channels).toEqual({
            telegram: { id: MANAGEMENT_CONNECTION_IDS.telegram, token: "telegram-token" },
            zaloOa: {
                id: MANAGEMENT_CONNECTION_IDS.zaloOa,
                appId: "1234567",
                appSecret: "app-secret-1",
                oaSecret: "PENDING-until-issued",
            },
            sepay: {
                id: MANAGEMENT_CONNECTION_IDS.sepay,
                bankCode: "VCB",
                accountNumber: "0123456789",
                holder: "NIVO",
                apiKey: SEPAY_KEY,
                apiToken: SEPAY_API_TOKEN,
            },
            payos: {
                id: MANAGEMENT_CONNECTION_IDS.payos,
                clientId: "client",
                apiKey: "payos-key-1",
                checksumKey: "checksum-1",
            },
            google: {
                id: MANAGEMENT_CONNECTION_IDS.google,
                clientId: "client-id.apps.test",
                clientSecret: "client-secret-1",
            },
        })
    })

    it("gives the connections the same fixed ids in every document", () => {
        expect(MANAGEMENT_CONNECTION_IDS).toEqual({
            sepay: "44c471c0-1a75-42e2-ac4b-09dded78c263",
            payos: "103ceb10-102c-4904-9ce4-d9c1b03ddcef",
            zaloOa: "ff2e59dc-5ed2-4327-8a73-ca3526bc3b6f",
            telegram: "72f2699d-7f93-45e1-964a-8a2228137985",
            google: "3cdf964f-f19f-4dde-80ff-c655deb2bd8a",
        })
    })

    it("reads a document without the mail server or the SePay key", () => {
        const seed = readManagementSeed(
            production(
                without(
                    "WORKSPACE_SMTP_HOST",
                    "WORKSPACE_SMTP_PORT",
                    "WORKSPACE_SMTP_USER",
                    "WORKSPACE_SMTP_PASSWORD",
                    "WORKSPACE_SMTP_FROM",
                    "WORKSPACE_SEPAY_API_KEY",
                    "WORKSPACE_SEPAY_API_TOKEN",
                ),
            ),
        )

        expect(seed.smtp).toBeUndefined()
        expect(seed.channels.sepay.apiKey).toBeUndefined()
        expect(seed.channels.sepay.apiToken).toBeUndefined()
    })

    it("reads a document without the Google OAuth client as one that seeds no Google connection", () => {
        const seed = readManagementSeed(
            production(without("WORKSPACE_GOOGLE_OAUTH_CLIENT_ID", "WORKSPACE_GOOGLE_OAUTH_CLIENT_SECRET")),
        )

        expect(seed.channels.google).toEqual({ id: MANAGEMENT_CONNECTION_IDS.google })
    })

    it.each([
        ["a part of the mail server", without("WORKSPACE_SMTP_HOST"), "WORKSPACE_SMTP"],
        ["a mail port outside the range", { ...SEALED, WORKSPACE_SMTP_PORT: "70000" }, "WORKSPACE_SMTP_PORT"],
        ["a sender that is no address", { ...SEALED, WORKSPACE_SMTP_FROM: "nobody" }, "WORKSPACE_SMTP_FROM"],
        ["an owner that is no address", { ...SEALED, WORKSPACE_OWNER_EMAIL: "owner" }, "ownerEmail"],
        ["no owner at all", without("WORKSPACE_OWNER_EMAIL"), "ownerEmail"],
        ["a value that is not text", { ...SEALED, WORKSPACE_TELEGRAM_BOT_TOKEN: 5 }, "WORKSPACE_TELEGRAM_BOT_TOKEN"],
    ])("refuses %s by the name of the field", (_name, values, field) => {
        expect(() => readManagementSeed(production(values))).toThrow(refused(field))
    })
})

describe("readManagementSeed > a development document", () => {
    it("reads the owner it names and leaves every connection without credentials", () => {
        const seed = readManagementSeed(dev)

        expect(seed.ownerEmail).toBe("dev-owner@nivo.test")
        expect(seed.smtp).toBeUndefined()
        expect(seed.channels.telegram).toEqual({ id: MANAGEMENT_CONNECTION_IDS.telegram, token: undefined })
        expect(seed.channels.zaloOa.appSecret).toBeUndefined()
        expect(seed.channels.payos.apiKey).toBeUndefined()
    })

    it("takes the owner from the sealed values when both name one, and from the document when the member lacks it", () => {
        const both = { ...dev, values: { WORKSPACE_OWNER_EMAIL: "owner@nivo.test" } }

        expect(readManagementSeed(both).ownerEmail).toBe("owner@nivo.test")
        expect(readManagementSeed({ ...dev, values: { WORKSPACE_TELEGRAM_BOT_TOKEN: "t" } }).ownerEmail).toBe(
            "dev-owner@nivo.test",
        )
    })
})

describe("readManagementSeed > a document off its contract", () => {
    it.each([
        ["not an object", "text", "schema"],
        ["another schema", { ...dev, schema: "other@1" }, "schema"],
        ["no workspace name", { ...dev, workspaceName: " " }, "workspaceName"],
        ["values that are no object", { ...dev, ownerEmail: undefined, values: [] }, "values"],
    ])("refuses %s", (_name, document, field) => {
        expect(() => readManagementSeed(document)).toThrow(refused(field))
    })
})

describe("readSeedDocuments", () => {
    it("reads the documents of the envelope the stack seed step writes", () => {
        const envelope = {
            env: "dev",
            scope: "dev",
            entry: "nivo-workspace",
            kind: "data",
            documents: [{ path: "data/a.json", document: dev }],
        }

        expect(readSeedDocuments(`${JSON.stringify(envelope)}\n`)).toEqual([dev])
    })

    it.each([
        ["text that is not JSON", "{"],
        ["an envelope without documents", "{}"],
        ["a document entry without its document", JSON.stringify({ documents: [{ path: "a" }] })],
    ])("refuses %s as an input it cannot read", (_name, text) => {
        expect(() => readSeedDocuments(text)).toThrow(refused("input"))
    })
})
