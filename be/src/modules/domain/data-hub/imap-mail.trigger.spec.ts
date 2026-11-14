import { Test } from "@nestjs/testing"
import { PROVIDER, TRIGGER } from "@nivo-lite/agent-sdk/names"
import { IMAP_MAIL_TRIGGER as realTrigger } from "./imap-mail.trigger"

const SUBJECT = Symbol("imap-mail.trigger")

const buildSubject = async (): Promise<typeof realTrigger> => {
    const moduleRef = await Test.createTestingModule({ providers: [{ provide: SUBJECT, useValue: realTrigger }] }).compile()
    return moduleRef.get<typeof realTrigger>(SUBJECT)
}

const ORIGIN = { connectionId: "mailbox-1" }

const row = {
    externalId: "INBOX:7:42",
    folder: "INBOX",
    uid: 42,
    date: "2026-11-14T01:00:00.000Z",
    from: [{ address: "a@b.test" }],
    subject: "Hoa don",
    text: "words never in the event",
    attachments: [],
    messageId: "<m1@b.test>",
}

describe("the mailbox's trigger", () => {
    it("is the mail verb, received by the sync's poll, with no key", async () => {
        const trigger = await buildSubject()

        expect([trigger.provider, trigger.name, trigger.verb, trigger.via, trigger.key]).toEqual([
            PROVIDER.imap,
            "mail.received",
            TRIGGER.mailMessageReceived,
            "poll",
            { by: "none" },
        ])
    })

    it("translates a stored mail row into one event with its ids and its time, never its words or its sender", async () => {
        const trigger = await buildSubject()
        const raw = trigger.raw.parse(row)

        const event = trigger.translate(raw, ORIGIN)
        expect(event).toEqual({ id: "INBOX:7:42", data: { mailId: "INBOX:7:42", folder: "INBOX", at: "2026-11-14T01:00:00.000Z", messageId: "<m1@b.test>" } })
        expect(trigger.translate(raw, ORIGIN)).toEqual(event)
        expect(event?.subject).toBeUndefined()
        expect(trigger.data.safeParse(event?.data).success).toBe(true)
    })

    it("leaves out a time or a Message-ID the row lacks", async () => {
        const trigger = await buildSubject()

        expect(trigger.translate({ externalId: "INBOX:7:43", folder: "INBOX", uid: 43, date: null }, ORIGIN)?.data).toEqual({ mailId: "INBOX:7:43", folder: "INBOX" })
    })
})
