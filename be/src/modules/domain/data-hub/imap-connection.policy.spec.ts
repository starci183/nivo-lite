import type * as SubjectModule from "./imap-connection.policy"
import { Test } from "@nestjs/testing"
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

const SUBJECT = Symbol("imap-connection.policy")
type Subject = Pick<
    typeof SubjectModule,
    "parseCredential" | "parseConfig" | "credentialFromInput" | "settingsFromInput" | "metaFromSettings" | "cursorKey"
>

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    parseCredential,
                    parseConfig,
                    credentialFromInput,
                    settingsFromInput,
                    metaFromSettings,
                    cursorKey,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

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
        async (secure) => {
            const subject = await buildSubject()

            expect(subject.parseCredential(JSON.stringify({ ...credential, secure }))).toEqual({
                ...credential,
                secure: secure !== false,
            })
        },
    )

    it.each(["broken", "null", "42", '"credential"', "[]", "{}"])("refuses unusable JSON %s", async (raw) => {
        const subject = await buildSubject()

        await refused(() => subject.parseCredential(raw), IMAP_CONNECTION_TEXT.credentialMissing)
    })

    it.each([{ host: 1 }, { user: null }, { password: false }, { port: "993" }])(
        "refuses a credential with an invalid required field %j",
        async (change) => {
            const subject = await buildSubject()

            await refused(
                () => subject.parseCredential(JSON.stringify({ ...credential, ...change })),
                IMAP_CONNECTION_TEXT.credentialMissing,
            )
        },
    )
})

describe("parseConfig", () => {
    it.each(["broken", "null", "42"])("uses the INBOX fallback for non-object JSON %s", async (config) => {
        const subject = await buildSubject()

        expect(subject.parseConfig({ config })).toEqual({ folders: ["INBOX"], sinceDays: 30 })
    })

    it("keeps an empty folder list when configuration is absent or its folders are not an array", async () => {
        const subject = await buildSubject()

        expect(subject.parseConfig({})).toEqual({ folders: [], sinceDays: 30 })
        expect(subject.parseConfig({ config: '{"folders":"INBOX","sinceDays":"7"}' })).toEqual({
            folders: [],
            sinceDays: 30,
        })
    })

    it("filters invalid folder entries and keeps only the first twenty accepted paths", async () => {
        const subject = await buildSubject()

        const folders = Array.from({ length: 22 }, (_unused, index) => `Folder ${index}`)
        expect(
            subject.parseConfig({
                config: JSON.stringify({
                    folders: [null, 1, "", "x".repeat(201), "x".repeat(200), ...folders],
                    sinceDays: 60,
                }),
            }),
        ).toEqual({ folders: ["x".repeat(200), ...folders.slice(0, 19)], sinceDays: 30 })
    })

    it.each([7, 30, 90])("keeps an accepted look-back of %s days", async (sinceDays) => {
        const subject = await buildSubject()

        expect(subject.parseConfig({ config: JSON.stringify({ folders: ["INBOX"], sinceDays }) })).toEqual({
            folders: ["INBOX"],
            sinceDays,
        })
    })
})

describe("credentialFromInput", () => {
    it("trims host and user while keeping the typed password and implicit TLS", async () => {
        const subject = await buildSubject()

        expect(subject.credentialFromInput(input, "stored-password")).toEqual({
            host: "imap.example.com",
            port: 993,
            secure: true,
            user: "support@example.com",
            password: "typed-password",
        })
    })

    it("reuses a saved password and selects STARTTLS", async () => {
        const subject = await buildSubject()

        expect(
            subject.credentialFromInput({ ...input, password: "", security: "starttls", port: 143 }, "stored-password"),
        ).toEqual({
            host: "imap.example.com",
            port: 143,
            secure: false,
            user: "support@example.com",
            password: "stored-password",
        })
    })

    it.each([" ", "x".repeat(254), "mail server", "mail/server"])("refuses the invalid host %s", async (host) => {
        const subject = await buildSubject()

        await refused(() => subject.credentialFromInput({ ...input, host }, null), IMAP_CONNECTION_TEXT.hostInvalid)
    })

    it.each([1.5, 0, 65_536])("refuses the invalid port %s", async (port) => {
        const subject = await buildSubject()

        await refused(() => subject.credentialFromInput({ ...input, port }, null), IMAP_CONNECTION_TEXT.portInvalid)
    })

    it("refuses an unsupported security mode", async () => {
        const subject = await buildSubject()

        await refused(
            () => subject.credentialFromInput({ ...input, security: "plain" }, null),
            IMAP_CONNECTION_TEXT.securityInvalid,
        )
    })

    it.each([" ", "x".repeat(321)])("refuses the invalid login name %s", async (user) => {
        const subject = await buildSubject()

        await refused(() => subject.credentialFromInput({ ...input, user }, null), IMAP_CONNECTION_TEXT.userMissing)
    })

    it.each([null, ""])("refuses a blank typed password when its saved value is %s", async (savedPassword) => {
        const subject = await buildSubject()

        await refused(
            () => subject.credentialFromInput({ ...input, password: "" }, savedPassword),
            IMAP_CONNECTION_TEXT.passwordMissing,
        )
    })
})

describe("credentialFromInput", () => {
    it.each([1, 65_535])("accepts the port boundary %s and maximum host and user lengths", async (port) => {
        const subject = await buildSubject()

        expect(
            subject.credentialFromInput({ ...input, host: "x".repeat(253), user: "x".repeat(320), port }, null),
        ).toEqual({
            host: "x".repeat(253),
            port,
            secure: true,
            user: "x".repeat(320),
            password: "typed-password",
        })
    })
})

describe("settingsFromInput", () => {
    it("trims the name and email and keeps selected settings", async () => {
        const subject = await buildSubject()

        expect(subject.settingsFromInput(input)).toEqual({
            name: "Support mailbox",
            email: "support@example.com",
            folders: ["INBOX", "Sent"],
            sinceDays: 7,
            every: 60,
        })
        expect(SINCE_CHOICES).toEqual([7, 30, 90])
    })

    it.each([null, undefined])("defaults the look-back and manual schedule from %s", async (unset) => {
        const subject = await buildSubject()

        expect(subject.settingsFromInput({ ...input, sinceDays: unset, syncEveryMinutes: unset })).toEqual({
            name: "Support mailbox",
            email: "support@example.com",
            folders: ["INBOX", "Sent"],
            sinceDays: 30,
            every: null,
        })
    })

    it("filters and deduplicates folders before limiting to twenty and accepts boundary name/email lengths", async () => {
        const subject = await buildSubject()

        const folders = Array.from({ length: 21 }, (_unused, index) => `Folder ${index}`)
        expect(
            subject.settingsFromInput({
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
        const subject = await buildSubject()

        await refused(() => subject.settingsFromInput({ ...input, name }), IMAP_CONNECTION_TEXT.nameInvalid)
    })

    it("refuses an oversized email", async () => {
        const subject = await buildSubject()

        await refused(
            () => subject.settingsFromInput({ ...input, email: "x".repeat(321) }),
            IMAP_CONNECTION_TEXT.emailTooLong,
        )
    })
})

describe("settingsFromInput", () => {
    it.each([{ folders: undefined }, { folders: null }, { folders: [] }, { folders: ["", "x".repeat(201)] }])(
        "refuses absent usable folders $folders",
        async ({ folders }) => {
            const subject = await buildSubject()

            await refused(() => subject.settingsFromInput({ ...input, folders }), IMAP_CONNECTION_TEXT.folderMissing)
        },
    )

    it("refuses unsupported look-back and schedule values", async () => {
        const subject = await buildSubject()

        await refused(() => subject.settingsFromInput({ ...input, sinceDays: 60 }), IMAP_CONNECTION_TEXT.sinceInvalid)
        await refused(
            () => subject.settingsFromInput({ ...input, syncEveryMinutes: 30 }),
            IMAP_CONNECTION_TEXT.everyInvalid,
        )
    })
})

describe("settingsFromInput", () => {
    it.each([
        [30, 15],
        [90, 360],
    ])("accepts a look-back of %s days and schedule of %s minutes", async (sinceDays, syncEveryMinutes) => {
        const subject = await buildSubject()

        expect(subject.settingsFromInput({ ...input, sinceDays, syncEveryMinutes })).toEqual({
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
    ])("stores the full configuration and a concise summary for $shown", async ({ folders, shown }) => {
        const subject = await buildSubject()

        expect(
            subject.metaFromSettings({
                name: "Mailbox",
                email: "owner@example.com",
                folders,
                sinceDays: 90,
                every: null,
            }),
        ).toEqual({
            config: JSON.stringify({ folders, sinceDays: 90 }),
            summary: imapSummary(shown, 90),
            email: "owner@example.com",
        })
    })

    it("keeps the folder path intact in its cursor key", async () => {
        const subject = await buildSubject()

        expect(subject.cursorKey("Sent/2026")).toBe("cursor:Sent/2026")
    })
})
