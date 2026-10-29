import { createHash, createHmac } from "node:crypto"
import { Injectable } from "@nestjs/common"
import { SignJWT, calculateJwkThumbprint, exportJWK, importPKCS8, importSPKI, jwtVerify } from "jose"
import type { CryptoKey, KeyObject } from "jose"
import { ok, refused, signStateToken, verifyStateToken } from "@modules/platform/primitives"
import type { Outcome, OptionalSignedState, SignedState } from "@modules/platform/primitives"
import { PassportError, PassportErrorCode } from "./errors/passport.error"
import type { AccessClaims, IssuedAccessToken, JwksDocument } from "./passport.contracts"
import { InjectPassportOptions } from "./passport.decorators"
import type { PassportOptions } from "./passport.options"

const ALGORITHM = "EdDSA"
const STATE_LABEL = "passport.google-state"

interface KeyPair {
    readonly privateKey: CryptoKey | KeyObject
    readonly publicKey: CryptoKey | KeyObject
    readonly keyId: string
    readonly jwk: Record<string, string>
}

@Injectable()
/** The one signer and verifier of our access tokens (Ed25519 JWTs) and of the short-lived Google state; the public key is served as a JWKS. */
export class PassportTokensClient {
    private pair: Promise<KeyPair> | undefined

    constructor(@InjectPassportOptions() private readonly options: PassportOptions) {}

    /** Signs an access token for one device session. */
    async sign(claims: AccessClaims, now: Date): Promise<IssuedAccessToken> {
        const { privateKey, keyId } = await this.keys()
        const issuedAt = Math.floor(now.getTime() / 1000)
        const expiresAt = issuedAt + this.options.accessTtlSeconds
        const token = await new SignJWT({
            role: "authenticated",
            session_id: claims.sessionId,
            ...(claims.email === undefined ? {} : { email: claims.email }),
        })
            .setProtectedHeader({ alg: ALGORITHM, kid: keyId, typ: "JWT" })
            .setSubject(claims.sub)
            .setIssuer(this.options.issuer)
            .setAudience(this.options.audience)
            .setIssuedAt(issuedAt)
            .setExpirationTime(expiresAt)
            .sign(privateKey)
        return { token, expiresAt: new Date(expiresAt * 1000) }
    }

    /** The claims of a token that passed signature, issuer, audience and expiry, or a refusal. */
    async verify(token: string, now: Date): Promise<Outcome<AccessClaims, PassportErrorCode>> {
        const { publicKey } = await this.keys()
        try {
            const { payload } = await jwtVerify(token, publicKey, {
                algorithms: ["EdDSA"],
                issuer: this.options.issuer,
                audience: this.options.audience,
                currentDate: now,
            })
            if (
                payload.role !== "authenticated" ||
                typeof payload.sub !== "string" ||
                typeof payload.session_id !== "string"
            ) {
                return refused(PassportErrorCode.AccessTokenInvalid)
            }
            return ok({
                sub: payload.sub,
                sessionId: payload.session_id,
                ...(typeof payload.email === "string" ? { email: payload.email } : {}),
            })
        } catch (cause) {
            return refused(PassportErrorCode.AccessTokenInvalid, { cause: String(cause) })
        }
    }

    /** The public key document. */
    async jwks(): Promise<JwksDocument> {
        const { jwk } = await this.keys()
        return { keys: [jwk] }
    }

    /** Signs the state of a Google round trip (an HMAC under a key derived from the signing key). */
    signState(state: SignedState): string {
        return signStateToken(this.stateKey(), state)
    }

    /** The state when the value is ours, unexpired and untampered; otherwise null. */
    verifyState(value: string, now: Date): OptionalSignedState {
        return verifyStateToken(this.stateKey(), value, now.getTime())
    }

    private stateKey(): Buffer {
        const material = createHash("sha256").update(this.options.privateKey.reveal(), "utf8").digest()
        return createHmac("sha256", material).update(STATE_LABEL).digest()
    }

    private keys(): Promise<KeyPair> {
        this.pair ??= this.load()
        return this.pair
    }

    private async load(): Promise<KeyPair> {
        const pem = this.options.privateKey.reveal().replaceAll(String.raw`\n`, "\n")
        const [privateKey, publicKey] = await Promise.all([
            importPKCS8(pem, ALGORITHM),
            importSPKI(this.options.publicKey, ALGORITHM, { extractable: true }),
        ]).catch((cause: unknown) => {
            throw new PassportError({ code: PassportErrorCode.KeyInvalid, cause })
        })
        const exported = await exportJWK(publicKey)
        const keyId = this.options.keyId ?? (await calculateJwkThumbprint(exported))
        const jwk: Record<string, string> = {}
        for (const [name, value] of Object.entries({ ...exported, kid: keyId, alg: ALGORITHM, use: "sig" })) {
            if (typeof value === "string") jwk[name] = value
        }
        return { privateKey, publicKey, keyId, jwk }
    }
}
