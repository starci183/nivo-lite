import { createHmac } from "node:crypto"
import { Test } from "@nestjs/testing"
import { sameSession, signBridgeToken, verifyBridgeToken } from "./bridge-credential.policy"

const SUBJECT = Symbol("bridge-credential.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { sameSession, signBridgeToken, verifyBridgeToken } }],
    }).compile()
    return moduleRef.get<{
        sameSession: typeof sameSession
        signBridgeToken: typeof signBridgeToken
        verifyBridgeToken: typeof verifyBridgeToken
    }>(SUBJECT)
}

const NOW = 1_800_000_000
const claims = { agentId: "ws-0123abcd-chatbot", sessionKey: "agent:ws-0123abcd-chatbot:conv-1", exp: NOW + 60 }

/** A credential with any body, signed the way the plugin signs, so a body of the wrong shape can reach the claims check. */
const signedBody = (body: string): string => {
    const mac = createHmac("sha256", "secret").update(`bridge.${body}`).digest("base64url")
    return `bridge.${body}.${mac}`
}

const encode = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString("base64url")

describe("bridge credential > verifyBridgeToken", () => {
    it("signs the same bytes as the plugin (nivo-bridge/bridge-token.js signed this exact credential)", async () => {
        const subject = await build()
        const fromPlugin =
            "bridge.eyJhIjoid3MtMDEyM2FiY2QtY2hhdGJvdCIsInMiOiJhZ2VudDp3cy0wMTIzYWJjZC1jaGF0Ym90OmNvbnYtMSIsImUiOjE4MDAwMDAwMDB9.hssHGg2O-C1syPfbiy92YrT6H-kEulPLHm15O_tp1z4"

        expect(subject.signBridgeToken("secret", { ...claims, exp: 1_800_000_000 })).toBe(fromPlugin)
        expect(subject.verifyBridgeToken("secret", fromPlugin, 1_799_999_940)).toEqual({
            ...claims,
            exp: 1_800_000_000,
        })
    })

    it("reads the claims of a credential signed with the secret", async () => {
        const subject = await build()

        const token = subject.signBridgeToken("secret", claims)

        expect(token.startsWith("bridge.")).toBe(true)
        expect(subject.verifyBridgeToken("secret", token, NOW)).toEqual(claims)
    })

    it("refuses a credential signed with another secret", async () => {
        const subject = await build()

        expect(subject.verifyBridgeToken("other", subject.signBridgeToken("secret", claims), NOW)).toBeNull()
    })

    it("refuses claims that were changed after signing", async () => {
        const subject = await build()
        const [, , mac = ""] = subject.signBridgeToken("secret", claims).split(".")
        const forged = encode({ a: "ws-other-chatbot", s: claims.sessionKey, e: claims.exp })

        expect(subject.verifyBridgeToken("secret", `bridge.${forged}.${mac}`, NOW)).toBeNull()
    })

    it("refuses an expired credential and one that claims to outlive the plugin's minute", async () => {
        const subject = await build()

        expect(subject.verifyBridgeToken("secret", subject.signBridgeToken("secret", claims), NOW + 61)).toBeNull()
        expect(
            subject.verifyBridgeToken("secret", subject.signBridgeToken("secret", { ...claims, exp: NOW + 121 }), NOW),
        ).toBeNull()
    })

    it("refuses a text that is not a bridge credential", async () => {
        const subject = await build()
        const token = subject.signBridgeToken("secret", claims)

        expect(subject.verifyBridgeToken("secret", "", NOW)).toBeNull()
        expect(subject.verifyBridgeToken("secret", token.replace("bridge.", "tool."), NOW)).toBeNull()
        expect(subject.verifyBridgeToken("secret", "bridge.onlybody", NOW)).toBeNull()
        expect(subject.verifyBridgeToken("secret", `${token}.extra`, NOW)).toBeNull()
    })

    it("refuses signed claims that are not an agent, a session and an expiry", async () => {
        const subject = await build()

        expect(subject.verifyBridgeToken("secret", signedBody(encode({ a: "", s: "k", e: NOW + 5 })), NOW)).toBeNull()
        expect(subject.verifyBridgeToken("secret", signedBody(encode({ a: "x", s: "", e: NOW + 5 })), NOW)).toBeNull()
        expect(subject.verifyBridgeToken("secret", signedBody(encode({ a: "x", s: "k", e: "soon" })), NOW)).toBeNull()
        expect(subject.verifyBridgeToken("secret", signedBody(encode("text")), NOW)).toBeNull()
        expect(subject.verifyBridgeToken("secret", signedBody(encode({ a: "x", s: "k", e: NOW + 5 })), NOW)).toEqual({
            agentId: "x",
            sessionKey: "k",
            exp: NOW + 5,
        })
    })

    it("refuses a body that is not JSON", async () => {
        const subject = await build()

        expect(
            subject.verifyBridgeToken("secret", signedBody(Buffer.from("not json").toString("base64url")), NOW),
        ).toBeNull()
    })
})

describe("bridge credential > sameSession", () => {
    it("matches a session key whatever its case", async () => {
        const subject = await build()

        expect(subject.sameSession("agent:a:Office:Main", "agent:a:office:main")).toBe(true)
        expect(subject.sameSession("agent:a:one", "agent:a:two")).toBe(false)
    })
})
