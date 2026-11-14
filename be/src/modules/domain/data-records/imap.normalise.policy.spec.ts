import { Test } from "@nestjs/testing"
import { imapMailInputsOf, imapMailValueOf } from "./imap.normalise.policy"
import { IMAP_MAIL_TEXT_MAX, IMAP_MAIL_TYPE, IMAP_SUBJECT_MAX, imapMail } from "./imap.data-types"

const SUBJECT = Symbol("imap.normalise.policy")

/** The policy's functions as the spec reads them, through the testing module. */
interface Subject {
    readonly imapMailInputsOf: typeof imapMailInputsOf
    readonly imapMailValueOf: typeof imapMailValueOf
}

const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { imapMailInputsOf, imapMailValueOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const ROW = {
    externalId: "INBOX:7:42",
    title: "Invoice 7",
    occurredAt: new Date("2026-11-10T08:00:00.000Z"),
    data: {
        folder: "INBOX",
        uid: 42,
        from: [{ name: "An", address: "an@example.com" }],
        to: [{ name: null, address: "shop@example.com" }],
        cc: [],
        subject: "Invoice 7",
        text: "Hello",
        truncated: false,
        attachments: [{ name: "hd.xml", type: "text/xml", size: 120, xml: "<HDon/>" }],
        messageId: "<m1@example.com>",
        inReplyTo: null,
    },
}

describe("imap.normalise.policy", () => {
    it("turns a mail row of the IMAP sync into exactly the declared imap.mail fields, a null header id left out", async () => {
        const { imapMailValueOf } = await build()
        const value = imapMailValueOf(ROW)

        expect(value).toEqual({
            externalId: "INBOX:7:42",
            folder: "INBOX",
            uid: 42,
            date: "2026-11-10T08:00:00.000Z",
            from: ROW.data.from,
            to: ROW.data.to,
            cc: [],
            subject: "Invoice 7",
            text: "Hello",
            truncated: false,
            attachments: ROW.data.attachments,
            messageId: "<m1@example.com>",
        })
        expect(Object.keys(value ?? {}).every((name) => name in imapMail.fields)).toBe(true)
    })

    it("keeps an unreadable mail: no date, no people, empty text", async () => {
        const { imapMailValueOf } = await build()
        const value = imapMailValueOf({
            externalId: "INBOX:7:43",
            title: "",
            occurredAt: null,
            data: { folder: "INBOX", uid: 43, subject: "", text: "", unreadable: true, attachments: [] },
        })

        expect(value).toEqual({
            externalId: "INBOX:7:43",
            folder: "INBOX",
            uid: 43,
            subject: "",
            text: "",
            unreadable: true,
            attachments: [],
        })
    })

    it("cuts a subject and a text to the declared lengths, so one odd mail never refuses its batch", async () => {
        const { imapMailValueOf } = await build()
        const value = imapMailValueOf({
            ...ROW,
            data: { ...ROW.data, subject: "s".repeat(IMAP_SUBJECT_MAX + 5), text: "t".repeat(IMAP_MAIL_TEXT_MAX + 5) },
        })

        expect(String(value?.subject)).toHaveLength(IMAP_SUBJECT_MAX)
        expect(String(value?.text)).toHaveLength(IMAP_MAIL_TEXT_MAX)
    })

    it("leaves out a row with no usable id, as the hub skipped it, and types each kept one imap.mail", async () => {
        const { imapMailInputsOf } = await build()
        const inputs = imapMailInputsOf([ROW, { ...ROW, externalId: "" }, { ...ROW, externalId: "x".repeat(301) }])

        expect(inputs.map((input) => [input.type, input.value.externalId])).toEqual([[IMAP_MAIL_TYPE, "INBOX:7:42"]])
    })

    it("reads the UID from the id when the row carries none", async () => {
        const { imapMailValueOf } = await build()
        expect(imapMailValueOf({ ...ROW, data: { ...ROW.data, uid: undefined } })).toMatchObject({ uid: 42 })
        expect(imapMailValueOf({ ...ROW, externalId: "INBOX:7:x", data: { ...ROW.data, uid: undefined } })).toBeNull()
    })
})
