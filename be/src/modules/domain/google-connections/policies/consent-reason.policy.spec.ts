import { Test } from "@nestjs/testing"
import { GoogleError, GoogleErrorCode } from "@modules/integrations/google"
import { GoogleConnectionsError, GoogleConnectionsErrorCode } from "../errors/google-connections.error"
import { consentFailureOf, deniedReason, storeFailureReason } from "./consent-reason.policy"

const SUBJECT = Symbol("consent-reason.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { deniedReason, consentFailureOf, storeFailureReason } }],
    }).compile()
    return moduleRef.get<typeof import("./consent-reason.policy")>(SUBJECT)
}

const refused = (reason: string) => new GoogleError({ code: GoogleErrorCode.Refused, params: { reason } })

describe("consent-reason.policy", () => {
    it("maps the error Google put on the callback", async () => {
        const subject = await buildSubject()

        expect(subject.deniedReason("access_denied")).toBe("denied")
        expect(subject.deniedReason("invalid_client")).toBe("unavailable")
        expect(subject.deniedReason("server_error")).toBe("failed")
    })

    it("reads the consent failure of a token call", async () => {
        const subject = await buildSubject()

        expect(subject.consentFailureOf(refused("invalid_client"))).toBe("invalid_client")
        expect(subject.consentFailureOf(refused("invalid_grant"))).toBe("")
        expect(subject.consentFailureOf(new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.Missing }))).toBe(
            "",
        )
    })

    it("maps a failure to store the consent", async () => {
        const subject = await buildSubject()

        expect(subject.storeFailureReason(refused("admin_policy_enforced"))).toBe("unavailable")
        expect(
            subject.storeFailureReason(new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.Missing })),
        ).toBe("no_refresh")
        expect(
            subject.storeFailureReason(new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.ScopeMissing })),
        ).toBe("scope")
        expect(subject.storeFailureReason(refused("invalid_grant"))).toBe("failed")
    })
})
