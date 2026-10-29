import { Test } from "@nestjs/testing"
import { inviteLinkMail, passwordLinkMail } from "./password-mail.policy"

const SUBJECT = Symbol("password-mail.policy")
type Subject = { inviteLinkMail: typeof inviteLinkMail; passwordLinkMail: typeof passwordLinkMail }
const LINK = "https://app.example.test/auth/reset?token=abc"

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { inviteLinkMail, passwordLinkMail } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("passwordLinkMail", () => {
    it.each([
        ["reset", "Reset your Nivo password"],
        ["invite", "Set your Nivo password"],
        ["confirm", "Confirm your Nivo email"],
    ] as const)("writes the %s email with its link and lifetime", async (kind, subject) => {
        const policy = await build()

        const mail = policy.passwordLinkMail(kind, LINK, 2)

        expect(mail.subject).toBe(subject)
        expect(mail.text).toContain(LINK)
        expect(mail.text).toContain("2 hours")
        expect(mail.html).toContain(subject)
    })
})

describe("inviteLinkMail", () => {
    it("carries the invitation link for a person who already has an account", async () => {
        const policy = await build()

        const mail = policy.inviteLinkMail("https://app.example.test/invite/t1")

        expect(mail.subject).toBe("You were invited to a Nivo workspace")
        expect(mail.text).toContain("https://app.example.test/invite/t1")
    })
})
