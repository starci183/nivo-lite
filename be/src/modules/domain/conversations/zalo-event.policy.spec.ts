import { Test } from "@nestjs/testing"
import { isZaloAttachmentEvent, readZaloEvent, zaloAttachmentShapeOf } from "./zalo-event.policy"

const SUBJECT = Symbol("zalo-event.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { readZaloEvent, isZaloAttachmentEvent, zaloAttachmentShapeOf } }],
    }).compile()
    return moduleRef.get<typeof import("./zalo-event.policy")>(SUBJECT)
}

const event = (patch: Record<string, unknown> = {}) =>
    Buffer.from(
        JSON.stringify({
            app_id: "app-1",
            event_name: "user_send_text",
            sender: { id: "user-1" },
            message: { msg_id: "m-1", text: " Hello " },
            ...patch,
        }),
    )

describe("readZaloEvent", () => {
    it("reads a customer text message with the app, the user and the message id", async () => {
        const subject = await buildSubject()

        expect(subject.readZaloEvent(event())).toEqual({
            kind: "ok",
            value: { appId: "app-1", userId: "user-1", messageId: "m-1", text: "Hello", attachments: [], sentAt: null },
        })
    })

    it("has an empty app id when the event names none", async () => {
        const subject = await buildSubject()

        expect(subject.readZaloEvent(event({ app_id: undefined }))).toMatchObject({ value: { appId: "" } })
    })

    it("refuses any other event and one that lacks the sender, the message id or the text", async () => {
        const subject = await buildSubject()

        const refusals = [
            subject.readZaloEvent(),
            subject.readZaloEvent(Buffer.from("[]")),
            subject.readZaloEvent(event({ event_name: "follow" })),
            subject.readZaloEvent(event({ sender: {} })),
            subject.readZaloEvent(event({ message: { text: "x" } })),
            subject.readZaloEvent(event({ message: { msg_id: "m-1" } })),
            subject.readZaloEvent(event({ message: { msg_id: "m-1", text: "   " } })),
        ]

        for (const refusal of refusals) expect(refusal.kind).toBe("refused")
    })
})

const imageEvent = (message: Record<string, unknown> = {}, patch: Record<string, unknown> = {}) =>
    event({
        event_name: "user_send_image",
        message: {
            msg_id: "m-2",
            text: " Em chuyen khoan roi ",
            attachments: [
                { type: "image", payload: { thumbnail: "https://cdn.test/t.jpg", url: "https://cdn.test/a.jpg" } },
                { type: "image", payload: { url: "https://cdn.test/b.jpg" } },
            ],
            ...message,
        },
        ...patch,
    })

describe("readZaloEvent the time of the event", () => {
    it("reads the timestamp Zalo sends as digits or as a number", async () => {
        const subject = await buildSubject()

        expect(subject.readZaloEvent(event({ timestamp: "1762217400123" }))).toMatchObject({
            value: { sentAt: 1_762_217_400_123 },
        })
        expect(subject.readZaloEvent(event({ timestamp: 1_762_217_400_123 }))).toMatchObject({
            value: { sentAt: 1_762_217_400_123 },
        })
        expect(subject.readZaloEvent(imageEvent({}, { timestamp: "1762217400123" }))).toMatchObject({
            value: { sentAt: 1_762_217_400_123 },
        })
    })

    it("has no time when the event carries none that is usable", async () => {
        const subject = await buildSubject()

        for (const timestamp of ["", "  ", "soon", 0, -5, null, {}]) {
            expect(subject.readZaloEvent(event({ timestamp }))).toMatchObject({ value: { sentAt: null } })
        }
    })
})

describe("readZaloEvent pictures and files", () => {
    it("reads a picture event with its caption, every address and the thumbnail", async () => {
        const subject = await buildSubject()

        expect(subject.readZaloEvent(imageEvent())).toEqual({
            kind: "ok",
            value: {
                appId: "app-1",
                userId: "user-1",
                messageId: "m-2",
                text: "Em chuyen khoan roi",
                sentAt: null,
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
            },
        })
    })

    it("reads a picture that came without a caption", async () => {
        const subject = await buildSubject()

        expect(subject.readZaloEvent(imageEvent({ text: undefined }))).toMatchObject({
            kind: "ok",
            value: { text: "" },
        })
    })

    it("reads a file event with its name", async () => {
        const subject = await buildSubject()
        const file = event({
            event_name: "user_send_file",
            message: {
                msg_id: "m-3",
                attachments: [{ type: "file", payload: { url: "https://cdn.test/f.pdf", name: "bill.pdf" } }],
            },
        })

        expect(subject.readZaloEvent(file)).toMatchObject({
            kind: "ok",
            value: { attachments: [{ kind: "file", url: "https://cdn.test/f.pdf", name: "bill.pdf" }] },
        })
    })

    it("leaves out an attachment with no address and refuses an event that has none left", async () => {
        const subject = await buildSubject()
        const mixed = imageEvent({
            attachments: [
                { type: "image", payload: {} },
                { type: "image" },
                "junk",
                { payload: { url: "https://cdn.test/c.jpg" } },
            ],
        })

        expect(subject.readZaloEvent(mixed)).toMatchObject({
            kind: "ok",
            value: { attachments: [{ url: "https://cdn.test/c.jpg" }] },
        })
        expect(subject.readZaloEvent(imageEvent({ attachments: [{ payload: {} }] })).kind).toBe("refused")
        expect(subject.readZaloEvent(imageEvent({ attachments: "x" })).kind).toBe("refused")
        expect(subject.readZaloEvent(imageEvent({ attachments: undefined })).kind).toBe("refused")
        expect(subject.readZaloEvent(imageEvent({}, { message: "x" })).kind).toBe("refused")
    })

    it("refuses a picture event that lacks the sender or the message id", async () => {
        const subject = await buildSubject()

        expect(subject.readZaloEvent(imageEvent({}, { sender: {} })).kind).toBe("refused")
        expect(subject.readZaloEvent(imageEvent({ msg_id: undefined })).kind).toBe("refused")
    })

    it("takes a local path only from a manual import", async () => {
        const subject = await buildSubject()
        const imported = imageEvent({ attachments: [{ type: "image", localPath: "receipts/a.jpg", payload: {} }] })

        expect(subject.readZaloEvent(imported).kind).toBe("refused")
        expect(subject.readZaloEvent(imported, { allowLocalPath: true })).toMatchObject({
            kind: "ok",
            value: { attachments: [{ kind: "image", url: "", localPath: "receipts/a.jpg" }] },
        })
    })
})

describe("zalo attachment events", () => {
    it("knows a picture or file event from a text event", async () => {
        const subject = await buildSubject()

        expect(subject.isZaloAttachmentEvent(imageEvent())).toBe(true)
        expect(subject.isZaloAttachmentEvent(event({ event_name: "user_send_file" }))).toBe(true)
        expect(subject.isZaloAttachmentEvent(event())).toBe(false)
        expect(subject.isZaloAttachmentEvent(Buffer.from("[]"))).toBe(false)
        expect(subject.isZaloAttachmentEvent()).toBe(false)
    })

    it("describes the shape by field names only, never by value", async () => {
        const subject = await buildSubject()

        const shape = subject.zaloAttachmentShapeOf(imageEvent())

        expect(shape).toBe("message[attachments,msg_id,text] attachment[payload,type] payload[thumbnail,url]")
        expect(shape).not.toContain("cdn.test")
    })

    it("marks the parts that are missing", async () => {
        const subject = await buildSubject()

        expect(subject.zaloAttachmentShapeOf(imageEvent({ attachments: [] }, { message: undefined }))).toBe(
            "message[-] attachment[-] payload[-]",
        )
        expect(subject.zaloAttachmentShapeOf(imageEvent({ attachments: ["x"] }))).toBe(
            "message[attachments,msg_id,text] attachment[-] payload[-]",
        )
        expect(subject.zaloAttachmentShapeOf()).toBe("")
    })
})

describe("readZaloEvent a live picture event", () => {
    /** The shape of a real `user_send_image`, redacted: no caption, no name, addresses without a query or an extension. */
    const live = Buffer.from(
        JSON.stringify({
            event_name: "user_send_image",
            app_id: "app-1",
            sender: { id: "user-1" },
            recipient: { id: "oa-1" },
            message: {
                msg_id: "m-live",
                attachments: [
                    {
                        type: "image",
                        payload: {
                            url: "https://photo-stal-34.zdn.vn/jpg/aaaa/bbbb",
                            thumbnail: "https://photo-stal-34.zdn.vn/jpg/aaaa/thumb",
                        },
                    },
                ],
            },
            timestamp: "1762217400123",
            user_id_by_app: "uid-1",
        }),
    )

    it("reads the full address and the preview, with no caption and no name, and the time of the event", async () => {
        const subject = await buildSubject()

        expect(subject.readZaloEvent(live)).toEqual({
            kind: "ok",
            value: {
                appId: "app-1",
                userId: "user-1",
                messageId: "m-live",
                text: "",
                sentAt: 1_762_217_400_123,
                attachments: [
                    {
                        kind: "image",
                        url: "https://photo-stal-34.zdn.vn/jpg/aaaa/bbbb",
                        thumbnailUrl: "https://photo-stal-34.zdn.vn/jpg/aaaa/thumb",
                        name: "",
                        localPath: "",
                    },
                ],
            },
        })
    })
})
