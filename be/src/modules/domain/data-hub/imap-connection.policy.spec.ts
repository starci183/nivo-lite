import type { ImapInput } from "./imap-connection.contracts"
import {
    credentialFromInput,
    cursorKey,
    metaFromSettings,
    parseConfig,
    parseCredential,
    settingsFromInput,
    SINCE_CHOICES,
} from "./imap-connection.policy"
import { DataHubErrorCode } from "./errors/data-hub.error"
import { IMAP_CONNECTION_TEXT, imapSummary } from "./messages/imap-connection.messages"

const input: ImapInput = {
    name: " Support mailbox ",
    email: " support@example.com ",
    host: " imap.example.com ",
    port: 993,
    security: "tls",
    user: " support@example.com ",
    password: "typed-password",
    folders: ["INBOX", "Sent"],
    sinceDays: 7,
    syncEveryMinutes: 60,
}
const credential = { host: "imap.example.com", port: 993, user: "owner", password: "secret" }
const refused = async (run: () => unknown, detail: string): Promise<void> => {
    await expect(Promise.resolve().then(run)).rejects.toMatchObject({
        code: DataHubErrorCode.Invalid,
        params: { detail },
    })
}

describe("parseCredential", () => {
    it.each([undefined, true, false])(
        "reads the credential and treats secure=%s as an explicit opt-out only",
        (secure) => {
            expect(parseCredential(JSON.stringify({ ...credential, secure }))).toEqual({
                ...credential,
                secure: secure !== false,
            })
        },
    )

    it.each(["broken", "null", "42", '"credential"', "[]", "{}"])("refuses unusable JSON %s", async (raw) => {
        await refused(() => parseCredential(raw), IMAP_CONNECTION_TEXT.credentialMissing)
    })

    it.each([{ host: 1 }, { user: null }, { password: false }, { port: "993" }])(
        "refuses a credential with an invalid required field %j",
        async (change) => {
            await refused(
                () => parseCredential(JSON.stringify({ ...credential, ...change })),
                IMAP_CONNECTION_TEXT.credentialMissing,
            )
        },
    )
})

describe("parseConfig", () => {
    it.each(["broken", "null", "42"])("uses the INBOX fallback for non-object JSON %s", (config) => {
        expect(parseConfig({ config })).toEqual({ folders: ["INBOX"], sinceDays: 30 })
    })

    it("keeps an empty folder list when configuration is absent or its folders are not an array", () => {
        expect(parseConfig({})).toEqual({ folders: [], sinceDays: 30 })
        expect(parseConfig({ config: '{"folders":"INBOX","sinceDays":"7"}' })).toEqual({ folders: [], sinceDays: 30 })
    })

    it("filters invalid folder entries and keeps only the first twenty accepted paths", () => {
        const folders = Array.from({ length: 22 }, (_unused, index) => `Folder ${index}`)
        expect(
            parseConfig({
                config: JSON.stringify({
                    folders: [null, 1, "", "x".repeat(201), "x".repeat(200), ...folders],
                    sinceDays: 60,
                }),
            }),
        ).toEqual({ folders: ["x".repeat(200), ...folders.slice(0, 19)], sinceDays: 30 })
    })

    it.each([7, 30, 90])("keeps an accepted look-back of %s days", (sinceDays) => {
        expect(parseConfig({ config: JSON.stringify({ folders: ["INBOX"], sinceDays }) })).toEqual({
            folders: ["INBOX"],
            sinceDays,
        })
    })
})

describe("credentialFromInput", () => {
    it("trims host and user while keeping the typed password and implicit TLS", () => {
        expect(credentialFromInput(input, "stored-password")).toEqual({
            host: "imap.example.com",
            port: 993,
            secure: true,
            user: "support@example.com",
            password: "typed-password",
        })
    })

    it("reuses a saved password and selects STARTTLS", () => {
        expect(
            credentialFromInput({ ...input, password: "", security: "starttls", port: 143 }, "stored-password"),
        ).toEqual({
            host: "imap.example.com",
            port: 143,
            secure: false,
            user: "support@example.com",
            password: "stored-password",
        })
    })

    it.each([" ", "x".repeat(254), "mail server", "mail/server"])("refuses the invalid host %s", async (host) => {
        await refused(() => credentialFromInput({ ...input, host }, null), IMAP_CONNECTION_TEXT.hostInvalid)
    })

    it.each([1.5, 0, 65_536])("refuses the invalid port %s", async (port) => {
        await refused(() => credentialFromInput({ ...input, port }, null), IMAP_CONNECTION_TEXT.portInvalid)
    })

    it("refuses an unsupported security mode", async () => {
        await refused(
            () => credentialFromInput({ ...input, security: "plain" }, null),
            IMAP_CONNECTION_TEXT.securityInvalid,
        )
    })

    it.each([" ", "x".repeat(321)])("refuses the invalid login name %s", async (user) => {
        await refused(() => credentialFromInput({ ...input, user }, null), IMAP_CONNECTION_TEXT.userMissing)
    })

    it.each([null, ""])("refuses a blank typed password when its saved value is %s", async (savedPassword) => {
        await refused(
            () => credentialFromInput({ ...input, password: "" }, savedPassword),
            IMAP_CONNECTION_TEXT.passwordMissing,
        )
    })

    it.each([1, 65_535])("accepts the port boundary %s and maximum host and user lengths", (port) => {
        expect(credentialFromInput({ ...input, host: "x".repeat(253), user: "x".repeat(320), port }, null)).toEqual({
            host: "x".repeat(253),
            port,
            secure: true,
            user: "x".repeat(320),
            password: "typed-password",
        })
    })
})

describe("settingsFromInput", () => {
    it("trims the name and email and keeps selected settings", () => {
        expect(settingsFromInput(input)).toEqual({
            name: "Support mailbox",
            email: "support@example.com",
            folders: ["INBOX", "Sent"],
            sinceDays: 7,
            every: 60,
        })
        expect(SINCE_CHOICES).toEqual([7, 30, 90])
    })

    it.each([null, undefined])("defaults the look-back and manual schedule from %s", (unset) => {
        expect(settingsFromInput({ ...input, sinceDays: unset, syncEveryMinutes: unset })).toEqual({
            name: "Support mailbox",
            email: "support@example.com",
            folders: ["INBOX", "Sent"],
            sinceDays: 30,
            every: null,
        })
    })

    it("filters and deduplicates folders before limiting to twenty and accepts boundary name/email lengths", () => {
        const folders = Array.from({ length: 21 }, (_unused, index) => `Folder ${index}`)
        expect(
            settingsFromInput({
                ...input,
                name: "x".repeat(80),
                email: "x".repeat(320),
                folders: ["", "x".repeat(201), "x".repeat(200), "x".repeat(200), ...folders],
            }),
        ).toEqual({
            name: "x".repeat(80),
            email: "x".repeat(320),
            folders: ["x".repeat(200), ...folders.slice(0, 19)],
            sinceDays: 7,
            every: 60,
        })
    })

    it.each([" ", "x".repeat(81)])("refuses the invalid name %s", async (name) => {
        await refused(() => settingsFromInput({ ...input, name }), IMAP_CONNECTION_TEXT.nameInvalid)
    })

    it("refuses an oversized email", async () => {
        await refused(() => settingsFromInput({ ...input, email: "x".repeat(321) }), IMAP_CONNECTION_TEXT.emailTooLong)
    })

    it.each([{ folders: undefined }, { folders: null }, { folders: [] }, { folders: ["", "x".repeat(201)] }])(
        "refuses absent usable folders $folders",
        async ({ folders }) => {
            await refused(() => settingsFromInput({ ...input, folders }), IMAP_CONNECTION_TEXT.folderMissing)
        },
    )

    it("refuses unsupported look-back and schedule values", async () => {
        await refused(() => settingsFromInput({ ...input, sinceDays: 60 }), IMAP_CONNECTION_TEXT.sinceInvalid)
        await refused(() => settingsFromInput({ ...input, syncEveryMinutes: 30 }), IMAP_CONNECTION_TEXT.everyInvalid)
    })

    it.each([
        [30, 15],
        [90, 360],
    ])("accepts a look-back of %s days and schedule of %s minutes", (sinceDays, syncEveryMinutes) => {
        expect(settingsFromInput({ ...input, sinceDays, syncEveryMinutes })).toEqual({
            name: "Support mailbox",
            email: "support@example.com",
            folders: ["INBOX", "Sent"],
            sinceDays,
            every: syncEveryMinutes,
        })
    })
})

describe("mailbox metadata", () => {
    it.each([
        { folders: ["INBOX", "Sent"], shown: "INBOX, Sent" },
        { folders: ["INBOX", "Sent", "Archive", "Spam"], shown: "INBOX, Sent +2" },
    ])("stores the full configuration and a concise summary for $shown", ({ folders, shown }) => {
        expect(
            metaFromSettings({ name: "Mailbox", email: "owner@example.com", folders, sinceDays: 90, every: null }),
        ).toEqual({
            config: JSON.stringify({ folders, sinceDays: 90 }),
            summary: imapSummary(shown, 90),
            email: "owner@example.com",
        })
    })

    it("keeps the folder path intact in its cursor key", () => {
        expect(cursorKey("Sent/2026")).toBe("cursor:Sent/2026")
    })
})
