import type { PipeTransform, Type } from "@nestjs/common"
import { APP_PIPE } from "@nestjs/core"
import { HttpSecurityModule } from "@modules/platform/http-security"
import { buildWiringProof } from "../../fixtures/builders/api.builder"
import { AppModule } from "../../../../apps/api/src/app.module"
import { GoogleCallbackRequest } from "../../../features/api/google-connections/transport/http/dto/google-callback.request"

/** The query Google sends back to the consent redirect, as a real browser hands it over. */
const GOOGLE_REDIRECT = {
    state: "eyJ3Ijoid3MtMSJ9.c2lnbmF0dXJl",
    code: "4/0AVG7fiQ-example-code",
    scope: "email profile https://www.googleapis.com/auth/spreadsheets openid https://www.googleapis.com/auth/userinfo.email",
    authuser: "0",
    prompt: "consent",
    iss: "https://accounts.google.com",
}

/** The global validation pipe the api registers, the one every request goes through. */
const globalPipe = (): PipeTransform => {
    const { options } = buildWiringProof(AppModule)
    const binding = (HttpSecurityModule.register(options.httpSecurity).providers ?? []).find(
        (provider): provider is { provide: typeof APP_PIPE; useClass: Type<PipeTransform> } =>
            typeof provider === "object" &&
            "provide" in provider &&
            provider.provide === APP_PIPE &&
            "useClass" in provider,
    )
    expect(binding).toBeDefined()
    return binding === undefined ? { transform: (value: unknown) => value } : new binding.useClass()
}

const validate = (query: Readonly<Record<string, string>>): Promise<unknown> =>
    Promise.resolve(globalPipe().transform(query, { type: "query", metatype: GoogleCallbackRequest }))

describe("Google consent callback query", () => {
    it("takes the query Google really sends, with the scope, the session index, the prompt and the issuer it appends", async () => {
        await expect(validate(GOOGLE_REDIRECT)).resolves.toBeInstanceOf(GoogleCallbackRequest)
        await expect(validate({ ...GOOGLE_REDIRECT, hd: "nivo.vn" })).resolves.toMatchObject({ hd: "nivo.vn" })
    })

    it("takes the refusal Google sends when the person declines", async () => {
        await expect(validate({ state: GOOGLE_REDIRECT.state, error: "access_denied" })).resolves.toMatchObject({
            error: "access_denied",
        })
    })

    it("still refuses a field Google never sends", async () => {
        await expect(validate({ ...GOOGLE_REDIRECT, admin: "1" })).rejects.toMatchObject({
            code: "HTTP_SECURITY_REQUEST_INVALID",
            params: { fields: "admin" },
        })
    })
})
