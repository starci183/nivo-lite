import { GoogleError, GoogleErrorCode } from "@modules/integrations/google"
import { GoogleConnectionsError, GoogleConnectionsErrorCode } from "../errors/google-connections.error"
import { consentFailureOf, deniedReason, storeFailureReason } from "./consent-reason.policy"

const refused = (reason: string) => new GoogleError({ code: GoogleErrorCode.Refused, params: { reason } })

describe("consent-reason.policy", () => {
    it("maps the error Google put on the callback", () => {
        expect(deniedReason("access_denied")).toBe("denied")
        expect(deniedReason("invalid_client")).toBe("unavailable")
        expect(deniedReason("server_error")).toBe("failed")
    })

    it("reads the consent failure of a token call", () => {
        expect(consentFailureOf(refused("invalid_client"))).toBe("invalid_client")
        expect(consentFailureOf(refused("invalid_grant"))).toBe("")
        expect(consentFailureOf(new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.Missing }))).toBe("")
    })

    it("maps a failure to store the consent", () => {
        expect(storeFailureReason(refused("admin_policy_enforced"))).toBe("unavailable")
        expect(storeFailureReason(new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.Missing }))).toBe(
            "no_refresh",
        )
        expect(storeFailureReason(new GoogleConnectionsError({ code: GoogleConnectionsErrorCode.ScopeMissing }))).toBe(
            "scope",
        )
        expect(storeFailureReason(refused("invalid_grant"))).toBe("failed")
    })
})
