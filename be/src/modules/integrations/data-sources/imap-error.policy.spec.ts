import { Test } from "@nestjs/testing"
import { IMAP_TEXT } from "./messages/imap.messages"
import { describeImapError } from "./imap-error.policy"

const SUBJECT = Symbol("imap-error.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { describeImapError } }],
    }).compile()
    return moduleRef.get<typeof import("./imap-error.policy")>(SUBJECT)
}

const coded = (code: string, message = ""): unknown => ({ code, message, responseText: "", response: "" })

describe("describeImapError", () => {
    it("keeps a sentence that is already written for the owner", async () => {
        const subject = await buildSubject()

        expect(subject.describeImapError(new Error(IMAP_TEXT.hostNotFound))).toEqual({
            detail: IMAP_TEXT.hostNotFound,
            rejected: true,
        })
    })

    it("asks for an app password when the server says so, and otherwise reports a wrong login", async () => {
        const subject = await buildSubject()

        expect(
            subject.describeImapError({ authenticationFailed: true, responseText: "ALERT app password required" }),
        ).toEqual({
            detail: IMAP_TEXT.appPassword,
            rejected: true,
        })
        expect(subject.describeImapError({ message: "AUTHENTICATIONFAILED" })).toEqual({
            detail: IMAP_TEXT.wrongLogin,
            rejected: true,
        })
        expect(subject.describeImapError({ response: "Invalid login" })).toEqual({
            detail: IMAP_TEXT.wrongLogin,
            rejected: true,
        })
    })

    it("reports IMAP turned off, a missing folder, and a failure with nothing recognisable", async () => {
        const subject = await buildSubject()

        expect(subject.describeImapError({ responseText: "IMAP is disabled" })).toEqual({
            detail: IMAP_TEXT.imapDisabled,
            rejected: true,
        })
        expect(subject.describeImapError(new Error("Mailbox does not exist"))).toEqual({
            detail: IMAP_TEXT.folderMissing,
            rejected: true,
        })
        expect(subject.describeImapError({ message: "NO" })).toEqual({ detail: IMAP_TEXT.generic, rejected: false })
        expect(subject.describeImapError("down")).toEqual({ detail: IMAP_TEXT.generic, rejected: false })
        expect(subject.describeImapError({ code: 12, message: 12 })).toEqual({
            detail: IMAP_TEXT.generic,
            rejected: false,
        })
    })

    it.each<[string, string, boolean]>([
        ["ENOTFOUND", IMAP_TEXT.hostNotFound, false],
        ["ECONNREFUSED", IMAP_TEXT.refused, false],
        ["CONNECT_TIMEOUT", IMAP_TEXT.timeout, false],
        ["GREETING_TIMEOUT", IMAP_TEXT.timeout, false],
        ["ETIMEDOUT", IMAP_TEXT.timeout, false],
        ["ETIMEOUT", IMAP_TEXT.timeout, false],
        ["ClosedAfterConnectTLS", IMAP_TEXT.secureFailed, false],
        ["ECONNRESET", IMAP_TEXT.secureFailed, false],
        ["ERR_TLS_CERT_ALTNAME_INVALID", IMAP_TEXT.certInvalid, true],
        ["CERT_HAS_EXPIRED", IMAP_TEXT.certInvalid, true],
        ["DEPTH_ZERO_SELF_SIGNED_CERT", IMAP_TEXT.certInvalid, true],
        ["UNABLE_TO_VERIFY_LEAF_SIGNATURE", IMAP_TEXT.certInvalid, true],
        ["STARTTLS_INJECTION", IMAP_TEXT.starttlsFailed, false],
        ["UPGRADE_TIMEOUT", IMAP_TEXT.starttlsFailed, false],
    ])("maps %s", async (code, detail, rejected) => {
        const subject = await buildSubject()

        expect(subject.describeImapError(coded(code))).toEqual({ detail, rejected })
    })
})
