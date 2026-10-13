import { fitsAttachmentLimit, mailAttachmentsOf } from "./attachments.policy"

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
})
