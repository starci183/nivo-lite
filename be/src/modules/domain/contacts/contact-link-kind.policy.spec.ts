import { linkKindOf } from "./contact-link-kind.policy"

describe("linkKindOf", () => {
    it.each(["phone", "email", "external"])("keeps the kind %s", (kind) => {
        expect(linkKindOf(kind)).toBe(kind)
    })

    it.each(["", "channel", "PHONE", "sms"])("reads %p as phone", (kind) => {
        expect(linkKindOf(kind)).toBe("phone")
    })
})
