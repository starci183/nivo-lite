import { Test } from "@nestjs/testing"
import { PROVIDER, TRIGGER } from "@nivo-lite/agent-sdk/names"
import { ZALO_ATTACHMENT_LABELS } from "./messages/zalo-trigger.messages"
import {
    zaloLineOf,
    ZALO_MESSAGE_TRIGGER as realTrigger,
    ZALO_TRIGGERS as realTriggers,
    zaloAppIdOf as realAppIdOf,
    type ZaloEventRow,
} from "./zalo-message.trigger"

const SUBJECT = Symbol("zalo-message.trigger")
type Subject = { trigger: typeof realTrigger; triggers: typeof realTriggers; appIdOf: typeof realAppIdOf }

const buildSubject = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: SUBJECT, useValue: { trigger: realTrigger, triggers: realTriggers, appIdOf: realAppIdOf } },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const ORIGIN = { connectionId: "conn-1" }

const body = (patch: Record<string, unknown> = {}): Readonly<Record<string, unknown>> => ({
    app_id: "app-1",
    event_name: "user_send_text",
    timestamp: "1762217400123",
    sender: { id: "user-1" },
    message: { msg_id: "m-1", text: " Hello " },
    ...patch,
})

const row = (raw: Readonly<Record<string, unknown>>, source?: string): ZaloEventRow => ({
    eventId: "m-1",
    ...(typeof raw.event_name === "string" ? { event: raw.event_name } : {}),
    ...(source === undefined ? {} : { source }),
    raw,
})

describe("the Zalo message trigger", () => {
    it("declares the zalo message verb received by webhook, keyed by the person on the account, as the provider's one trigger", async () => {
        const { trigger, triggers } = await buildSubject()

        expect([trigger.provider, trigger.name, trigger.verb, trigger.via, trigger.key]).toEqual([
            PROVIDER.zaloOa,
            "message.received",
            TRIGGER.zaloMessageReceived,
            "webhook",
            { by: "subject" },
        ])
        expect(triggers).toEqual([trigger])
        expect(trigger.settle).toEqual({ windowMs: 6000, maxWaitMs: 20_000 })
    })

    it("translates a customer text into one event: Zalo's message id, the person by their Zalo id (no name: the webhook gives none), the line", async () => {
        const { trigger } = await buildSubject()

        expect(trigger.translate(row(body()), ORIGIN)).toEqual({
            id: "m-1",
            subject: { channel: "zalo", id: "user-1" },
            data: {
                messageKey: "zalo:m-1",
                text: "Hello",
                at: new Date(1_762_217_400_123).toISOString(),
                attachments: [],
            },
        })
    })

    it("is pure: the same row gives the same event whatever else holds, and its row and data fit the declared schemas", async () => {
        const { trigger } = await buildSubject()
        const one = row(body({ timestamp: 1_762_217_400_123 }))

        const first = trigger.translate(one, ORIGIN)
        expect(trigger.translate(one, ORIGIN)).toEqual(first)
        expect(trigger.translate(one, { connectionId: "conn-2" })).toEqual(first)
        expect(trigger.data.safeParse(first?.data).success).toBe(true)
        expect(trigger.raw.safeParse(one).success).toBe(true)
    })

    it("drops every event that is no customer line, as the intake always did", async () => {
        const { trigger } = await buildSubject()

        const dropped = [
            body({ event_name: "follow" }),
            body({ event_name: "user_seen_message" }),
            body({ event_name: "oa_send_text" }),
            body({ sender: {} }),
            body({ message: { text: "x" } }),
            body({ message: { msg_id: "m-1" } }),
            body({ message: { msg_id: "m-1", text: "   " } }),
            body({ event_name: "user_send_image", message: { msg_id: "m-2", attachments: [{ payload: {} }] } }),
        ]

        for (const raw of dropped) expect(trigger.translate(row(raw), ORIGIN)).toBeNull()
    })
})

describe("the Zalo message trigger: pictures and files", () => {
    it("reads a picture with its caption as the image label and the caption, its attachments in order", async () => {
        const { trigger } = await buildSubject()
        const picture = body({
            event_name: "user_send_image",
            message: {
                msg_id: "m-2",
                text: " Em chuyen khoan roi ",
                attachments: [
                    { type: "image", payload: { thumbnail: "https://cdn.test/t.jpg", url: "https://cdn.test/a.jpg" } },
                    { type: "image", payload: { url: "https://cdn.test/b.jpg" } },
                ],
            },
        })

        expect(trigger.translate(row(picture), ORIGIN)?.data).toEqual({
            messageKey: "zalo:m-2",
            text: `${ZALO_ATTACHMENT_LABELS.image} Em chuyen khoan roi`,
            at: new Date(1_762_217_400_123).toISOString(),
            attachments: [
                {
                    kind: "image",
                    url: "https://cdn.test/a.jpg",
                    thumbnailUrl: "https://cdn.test/t.jpg",
                    name: "",
                    localPath: "",
                },
                { kind: "image", url: "https://cdn.test/b.jpg", thumbnailUrl: "", name: "", localPath: "" },
            ],
        })
    })

    it("reads a file of the import folder only from a manual import", async () => {
        const { trigger } = await buildSubject()
        const imported = body({
            event_name: "user_send_file",
            message: { msg_id: "m-3", text: "", attachments: [{ localPath: "a/b.pdf", payload: { name: "b.pdf" } }] },
        })

        expect(trigger.translate(row(imported), ORIGIN)).toBeNull()
        expect(trigger.translate(row(imported, "manual_import"), ORIGIN)?.data).toMatchObject({
            text: ZALO_ATTACHMENT_LABELS.file,
            attachments: [{ kind: "file", url: "", name: "b.pdf", localPath: "a/b.pdf" }],
        })
    })
})

describe("the Zalo message trigger: the poll's row, its time and its data schema", () => {
    it("gives the poll's row the SAME event as the webhook's, named as the listing shows the person", async () => {
        const { trigger } = await buildSubject()
        const polled = body({ app_id: undefined, sender: { id: "user-1", display_name: " Lan " } })

        const read = trigger.translate(row(polled, "poll"), ORIGIN)
        expect(read?.id).toBe(trigger.translate(row(body()), ORIGIN)?.id)
        expect(read?.data).toEqual(trigger.translate(row(body()), ORIGIN)?.data)
        expect(read?.subject).toEqual({ channel: "zalo", id: "user-1", name: "Lan" })
    })

    it("has no time for an event that carries none, and names the app the body was sent for", async () => {
        const { trigger, appIdOf } = await buildSubject()

        expect(trigger.translate(row(body({ timestamp: undefined })), ORIGIN)?.data.at).toBeNull()
        expect(appIdOf(body())).toBe("app-1")
        expect(appIdOf(body({ app_id: undefined }))).toBe("")
    })

    it("accepts the engine's release delivery (no words, `resume: held`) in its data schema", async () => {
        const { trigger } = await buildSubject()

        expect(
            trigger.data.safeParse({ messageKey: "", text: "", at: null, attachments: [], resume: "held" }).success,
        ).toBe(true)
    })
})

describe("ZALO_MESSAGE_TRIGGER: the person's line (owner ruling R26)", () => {
    it("gives the engine the message's line: its key, its words, the channel's time", () => {
        expect(
            zaloLineOf({
                messageKey: "zalo:m-1",
                text: "Shop con hoa khong?",
                at: "2026-11-14T02:00:00.000Z",
                attachments: [],
            }),
        ).toEqual({
            key: "zalo:m-1",
            text: "Shop con hoa khong?",
            at: "2026-11-14T02:00:00.000Z",
        })
        expect(realTrigger.line).toBe(zaloLineOf)
    })

    it("gives no line for the release door's resume (no key)", () => {
        expect(zaloLineOf({ messageKey: "", text: "", at: null, attachments: [], resume: "held" })).toBeNull()
    })
})
