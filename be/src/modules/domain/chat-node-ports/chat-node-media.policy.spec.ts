import { Test } from "@nestjs/testing"
import { STORED_FILES_MAX, storedFilesOf } from "./chat-node-media.policy"

/** The members of the subject under test. */
interface Subject {
    readonly storedFilesOf: typeof storedFilesOf
}

const SUBJECT = Symbol("chat-node-media.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { storedFilesOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const QR = "https://qr.sepay.vn/img?acc=1&bank=MB&amount=5000&des=DH1&template=compact"

describe("storedFilesOf", () => {
    it("keeps the pictures of the send in order, named by the first line of their caption", async () => {
        const { storedFilesOf: filesOf } = await build()
        expect(
            filesOf({
                conversationId: "c1",
                text: "Hi",
                images: [
                    { url: "https://api/p/1/image", caption: "Basket\n2.000 VND" },
                    { url: "https://api/p/2/image.webp", caption: "" },
                ],
            }),
        ).toEqual([
            { id: "file-1", url: "https://api/p/1/image", name: "Basket", contentType: "image/jpeg" },
            { id: "file-2", url: "https://api/p/2/image.webp", name: "image", contentType: "image/webp" },
        ])
    })

    it("adds the picture files and the SePay QR the words link to, once each", async () => {
        const { storedFilesOf: filesOf } = await build()
        const files = filesOf({
            conversationId: "c1",
            text: `Scan: ${QR}.`,
            attachments: [
                { url: "https://x/menu.pdf", name: "Menu", contentType: "application/pdf" },
                { url: "https://x/photo", name: "Photo", contentType: "image/png" },
            ],
            images: [{ url: QR, caption: "DH1" }],
        })
        expect(files.map((file) => [file.url, file.name, file.contentType])).toEqual([
            [QR, "DH1", "image/png"],
            ["https://x/photo", "Photo", "image/png"],
        ])
        expect(filesOf({ conversationId: "c1", text: `Scan: ${QR}.` })).toEqual([
            { id: "file-1", url: QR, name: "image", contentType: "image/png" },
        ])
    })

    it("keeps nothing for a plain text and at most the limit for many pictures", async () => {
        const { storedFilesOf: filesOf } = await build()
        expect(filesOf({ conversationId: "c1", text: "Hi" })).toEqual([])
        const images = Array.from({ length: STORED_FILES_MAX + 3 }, (_unused, index) => ({
            url: `https://api/p/${String(index)}`,
            caption: "x",
        }))
        expect(filesOf({ conversationId: "c1", text: "Hi", images })).toHaveLength(STORED_FILES_MAX)
    })
})
