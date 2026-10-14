import { fitsAttachmentLimit, mailAttachmentsOf, MAX_ATTACHMENT_BYTES } from "./attachments.policy"

describe("attachments policy", () => {
    it("keeps at most three files with names a mail client reads safely", () => {
        const files = mailAttachmentsOf([
            { filename: "ca/lam?.csv", content: "a,b", contentType: "text/csv" },
            { filename: "b.txt", content: "Yg==", encoding: "base64" },
            { filename: "c.txt", content: "c" },
            { filename: "d.txt", content: "d" },
        ])
        expect(files.map((file) => [file.filename, file.content.toString("utf8")])).toEqual([
            ["ca_lam_.csv", "a,b"],
            ["b.txt", "b"],
            ["c.txt", "c"],
        ])
    })

    it("refuses files over 2 MB together", () => {
        const big = mailAttachmentsOf([
            { filename: "big.bin", content: Buffer.alloc(2_100_000, 1).toString("base64"), encoding: "base64" },
        ])
        expect(fitsAttachmentLimit(big)).toBe(false)
        expect(fitsAttachmentLimit(mailAttachmentsOf([{ filename: "a.txt", content: "a" }]))).toBe(true)
    })

    it("uses a fallback for an empty name and bounds long names to eighty characters", () => {
        expect(
            mailAttachmentsOf([
                { filename: "", content: "hi", contentType: "text/plain" },
                { filename: `${"a".repeat(80)}.txt`, content: "\u00e9", encoding: "utf8" },
            ]),
        ).toEqual([
            { filename: "attachment", content: Buffer.from("hi"), contentType: "text/plain" },
            { filename: "a".repeat(80), content: Buffer.from("\u00e9"), contentType: undefined },
        ])
    })

    it("accepts an empty list and the exact combined byte limit", () => {
        expect(MAX_ATTACHMENT_BYTES).toBe(2_000_000)
        expect(mailAttachmentsOf([])).toEqual([])
        expect(fitsAttachmentLimit([])).toBe(true)
        const files = [
            { filename: "one.bin", content: Buffer.alloc(MAX_ATTACHMENT_BYTES - 1) },
            { filename: "two.bin", content: Buffer.alloc(1) },
        ]
        expect(fitsAttachmentLimit(files)).toBe(true)
        expect(fitsAttachmentLimit([...files, { filename: "extra.bin", content: Buffer.alloc(1) }])).toBe(false)
    })
})
