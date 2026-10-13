import { newPassword, passwordFor, secretOf, withSecret } from "./workspace-seed.policy"

describe("workspace-seed policy", () => {
    const text = 'A=1\n  READY_OWNER_EMAIL="mai@nivo.vn"\nREADY_OWNER_PASSWORD=pw0123456789abcdef\n'

    it("reads a value with its quotes removed, and nothing for an absent key", () => {
        expect(secretOf(text, "READY_OWNER_EMAIL")).toBe("mai@nivo.vn")
        expect(secretOf(text, "READY_STAFF_EMAIL")).toBe("")
    })

    it("replaces the line of an existing key and appends a new one", () => {
        expect(withSecret(text, "A", "2")).toBe(
            'A=2\n  READY_OWNER_EMAIL="mai@nivo.vn"\nREADY_OWNER_PASSWORD=pw0123456789abcdef\n',
        )
        expect(withSecret("A=1\n", "B", "2")).toBe("A=1\nB=2\n")
        expect(withSecret("A=1", "B", "2")).toBe("A=1\nB=2\n")
        expect(withSecret("", "B", "2")).toBe("B=2\n")
    })

    it("keeps the stored password of the same account when it is long enough", () => {
        expect(passwordFor(text, "OWNER", "mai@nivo.vn", () => "fresh")).toBe("pw0123456789abcdef")
    })

    it.each([
        ["another email", "OWNER", "other@nivo.vn"],
        ["no stored password", "STAFF", "ha@nivo.vn"],
    ])("generates a password for %s", (_name, role, email) => {
        expect(passwordFor(text, role, email, () => "fresh")).toBe("fresh")
    })

    it("generates a password that is too short to keep", () => {
        const stored = "READY_OWNER_EMAIL=a@b.c\nREADY_OWNER_PASSWORD=short\n"

        expect(passwordFor(stored, "OWNER", "a@b.c", () => "fresh")).toBe("fresh")
    })

    it("makes 24 url safe characters, never the same twice", () => {
        const first = newPassword()

        expect(first).toMatch(/^[\w-]{24}$/)
        expect(newPassword()).not.toBe(first)
    })
})
