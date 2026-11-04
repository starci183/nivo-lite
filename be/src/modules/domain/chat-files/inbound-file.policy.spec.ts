import { resolve, sep } from "node:path"
import {
    INBOUND_FILE_HEADERS,
    importPathOf,
    inboundFileNameOf,
    isAcceptedDeclaredType,
    isFetchableFileUrl,
    isRedirectStatus,
    redirectTargetOf,
} from "./inbound-file.policy"

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
    it.each([
        "image/jpeg",
        "IMAGE/PNG; charset=binary",
        "application/pdf",
        "application/octet-stream",
        "binary/octet-stream",
        "",
        undefined,
    ])("lets %s through to the check of the bytes", (declared) => {
        expect(isAcceptedDeclaredType(declared)).toBe(true)
    })

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

    it.each(["../secret.txt", "receipts/../../secret.txt", resolve("elsewhere", "a.jpg"), "", "."])(
        "refuses %s, which leaves or is the folder",
        (path) => {
            expect(importPathOf(root, path)).toBeNull()
        },
    )

    it("does not take a sibling folder whose name starts like the import folder", () => {
        expect(importPathOf(root, `..${sep}.starciwork-other${sep}a.jpg`)).toBeNull()
    })
})

describe("isRedirectStatus", () => {
    it("is true for the statuses that send the client elsewhere and false for the rest", () => {
        expect([301, 302, 303, 307, 308].every(isRedirectStatus)).toBe(true)
        expect([200, 304, 404, 500].some(isRedirectStatus)).toBe(false)
    })
})

describe("redirectTargetOf", () => {
    it("resolves an absolute and a relative location against the address that answered", () => {
        expect(redirectTargetOf("https://cdn.example.test/b.jpg", "https://photo.example.test/a")).toBe(
            "https://cdn.example.test/b.jpg",
        )
        expect(redirectTargetOf("/b.jpg", "https://photo.example.test/a")).toBe("https://photo.example.test/b.jpg")
    })

    it("is null when the answer names no usable location", () => {
        expect(redirectTargetOf(undefined, "https://photo.example.test/a")).toBeNull()
        expect(redirectTargetOf("", "https://photo.example.test/a")).toBeNull()
        expect(redirectTargetOf("http://[bad", "https://photo.example.test/a")).toBeNull()
    })
})

describe("inboundFileNameOf", () => {
    it("keeps the name the sender gave", () => {
        expect(inboundFileNameOf("bill.pdf", "m-1", 0, "pdf")).toBe("bill.pdf")
    })

    it("names a file with no name after the message and its real type", () => {
        expect(inboundFileNameOf("", "ab12-CD_3", 0, "webp")).toBe("ab12-CD_3.webp")
    })

    it("tells the files of one message apart and keeps the id to safe characters", () => {
        expect(inboundFileNameOf("", "a/b c", 1, "jpg")).toBe("a_b_c-2.jpg")
        expect(inboundFileNameOf("", "", 0, "png")).toBe("file.png")
        expect(inboundFileNameOf("", "x".repeat(200), 0, "png")).toBe(`${"x".repeat(80)}.png`)
    })
})

describe("INBOUND_FILE_HEADERS", () => {
    it("asks for a picture the way a browser does", () => {
        expect(INBOUND_FILE_HEADERS.accept).toContain("image/*")
        expect(INBOUND_FILE_HEADERS["user-agent"]).toContain("Mozilla/5.0")
    })
})
