import { resolve, sep } from "node:path"
import { importPathOf, isAcceptedDeclaredType, isFetchableFileUrl } from "./inbound-file.policy"

describe("isFetchableFileUrl", () => {
    it("accepts an https address of a named host", () => {
        expect(isFetchableFileUrl("https://cdn.example.test/a/b.jpg?x=1")).toBe(true)
    })

    it.each([
        ["plain http", "http://cdn.example.test/a.jpg"],
        ["an IPv4 address", "https://10.0.0.5/a.jpg"],
        ["an IPv6 address", "https://[::1]/a.jpg"],
        ["localhost", "https://localhost/a.jpg"],
        ["an internal name", "https://db.internal/a.jpg"],
        ["a .local name", "https://printer.local/a.jpg"],
        ["an address with credentials", "https://user:pass@cdn.example.test/a.jpg"],
        ["an address with a user only", "https://user@cdn.example.test/a.jpg"],
        ["a file address", "file:///etc/passwd"],
        ["text that is no address", "not a url"],
        ["nothing", ""],
    ])("refuses %s", (_name, url) => {
        expect(isFetchableFileUrl(url)).toBe(false)
    })
})

describe("isAcceptedDeclaredType", () => {
    it.each(["image/jpeg", "IMAGE/PNG; charset=binary", "application/pdf", "application/octet-stream", "binary/octet-stream", "", undefined])(
        "lets %s through to the check of the bytes",
        (declared) => {
            expect(isAcceptedDeclaredType(declared)).toBe(true)
        },
    )

    it.each(["text/html", "application/json", "video/mp4"])("refuses %s", (declared) => {
        expect(isAcceptedDeclaredType(declared)).toBe(false)
    })
})

describe("importPathOf", () => {
    const root = resolve("work", ".starciwork")

    it("resolves a path inside the import folder", () => {
        expect(importPathOf(root, "receipts/a.jpg")).toBe(resolve(root, "receipts", "a.jpg"))
        expect(importPathOf(root, resolve(root, "a.jpg"))).toBe(resolve(root, "a.jpg"))
    })

    it.each(["../secret.txt", "receipts/../../secret.txt", resolve("elsewhere", "a.jpg"), "", "."])("refuses %s, which leaves or is the folder", (path) => {
        expect(importPathOf(root, path)).toBeNull()
    })

    it("does not take a sibling folder whose name starts like the import folder", () => {
        expect(importPathOf(root, `..${sep}.starciwork-other${sep}a.jpg`)).toBeNull()
    })
})
