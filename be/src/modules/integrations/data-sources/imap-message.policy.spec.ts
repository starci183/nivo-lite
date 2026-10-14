import { mock } from "@starci/jest-preset"
import type { AddressObject, Attachment, ParsedMail } from "mailparser"
import { IMAP_MAX_TEXT, formatImapCursor, messageToRow, parseImapCursor, unreadableRow } from "./imap-message.policy"

const address = (value: AddressObject["value"]): AddressObject => ({ value, html: "", text: "" })

const mail = (partial: Partial<ParsedMail>): ParsedMail =>
    mock<ParsedMail>({
        html: false,
        attachments: [],
        text: undefined,
        subject: undefined,
        date: undefined,
        from: undefined,
        to: undefined,
        cc: undefined,
        messageId: undefined,
        inReplyTo: undefined,
        ...partial,
    })

describe("imap message policy", () => {
    describe("cursors", () => {
        it("parses a saved cursor and writes one back", () => {
            expect(parseImapCursor(null)).toBeNull()
            expect(parseImapCursor("")).toBeNull()
            expect(parseImapCursor("nope")).toBeNull()
            expect(parseImapCursor("12:34")).toEqual({ validity: "12", uid: 34 })
            expect(formatImapCursor("12", 34)).toBe("12:34")
        })
    })

    describe("messageToRow", () => {
        it("keeps the text, the people and the attachment names", () => {
            const sent = new Date("2026-01-02T03:04:05.000Z")
            const row = messageToRow(
                "INBOX",
                "9",
                4,
                mail({
                    text: " Hello ",
                    subject: "Order",
                    date: sent,
                    from: address([
                        { name: "Ada", address: "ada@example.com" },
                        { name: "", address: "" },
                    ]),
                    to: [address([{ name: "Bo", address: undefined }])],
                    cc: undefined,
                    attachments: [mock<Attachment>({ filename: undefined, contentType: "image/png", size: 8 })],
                    messageId: "<m@example.com>",
                    inReplyTo: "<previous@example.com>",
                }),
                null,
            )

            expect(row).toEqual({
                externalId: "INBOX:9:4",
                title: "Order",
                occurredAt: sent,
                data: {
                    folder: "INBOX",
                    uid: 4,
                    from: [
                        { name: "Ada", address: "ada@example.com" },
                        { name: null, address: null },
                    ],
                    to: [{ name: "Bo", address: null }],
                    cc: [],
                    subject: "Order",
                    text: "Hello",
                    truncated: false,
                    attachments: [{ name: null, type: "image/png", size: 8 }],
                    messageId: "<m@example.com>",
                    inReplyTo: "<previous@example.com>",
                },
            })
        })

        it("reads HTML when there is no text, cuts a long body and falls back to the received date", () => {
            const received = new Date("2026-02-03T00:00:00.000Z")
            const body = `${"a".repeat(IMAP_MAX_TEXT)}tail`
            const row = messageToRow(
                "Sent",
                "1",
                2,
                mail({
                    text: undefined,
                    html: "<style>x</style><script>y</script>Hi&nbsp;&amp;&lt;b&gt; <b>there</b>",
                    subject: undefined,
                    date: new Date(Number.NaN),
                    attachments: [mock<Attachment>({ filename: "a.txt", contentType: "text/plain", size: 1 })],
                }),
                received,
            )

            expect(row.title).toBe("")
            expect(row.occurredAt).toEqual(received)
            expect(row.data.from).toEqual([])
            expect(row.data.to).toEqual([])
            expect(row.data.cc).toEqual([])
            expect(row.data.text).toBe("Hi &<b> there")
            expect(row.data.truncated).toBe(false)
            expect(row.data.messageId).toBeNull()
            expect(row.data.inReplyTo).toBeNull()
            expect(row.data.attachments).toEqual([{ name: "a.txt", type: "text/plain", size: 1 }])

            const long = messageToRow("Sent", "1", 3, mail({ text: body, date: undefined }), "not-a-date")
            expect(long.data.text).toBe("a".repeat(IMAP_MAX_TEXT))
            expect(long.data.truncated).toBe(true)
            expect(long.occurredAt).toBeNull()
        })

        it("keeps an empty parsed message with no date, addresses or body", () => {
            expect(messageToRow("INBOX", "9", 5, mail({}), null)).toEqual({
                externalId: "INBOX:9:5",
                title: "",
                occurredAt: null,
                data: {
                    folder: "INBOX",
                    uid: 5,
                    from: [],
                    to: [],
                    cc: [],
                    subject: "",
                    text: "",
                    truncated: false,
                    attachments: [],
                    messageId: null,
                    inReplyTo: null,
                },
            })
        })
    })

    describe("unreadableRow", () => {
        it("keeps the cursor identity and the received date when the message cannot be parsed", () => {
            const received = new Date("2026-04-05T00:00:00.000Z")

            expect(unreadableRow("INBOX", "9", 4, received)).toEqual({
                externalId: "INBOX:9:4",
                title: "",
                occurredAt: received,
                data: { folder: "INBOX", uid: 4, subject: "", text: "", unreadable: true, attachments: [] },
            })
            expect(unreadableRow("INBOX", "9", 4, undefined).occurredAt).toBeNull()
        })
    })
})
