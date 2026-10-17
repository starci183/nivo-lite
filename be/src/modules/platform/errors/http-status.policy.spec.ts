import { Test } from "@nestjs/testing"
import { HTTP_STATUS_BY_KIND as realStatus } from "./http-status.policy"

const SUBJECT = Symbol("http-status.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: [realStatus] }],
    }).compile()
    return moduleRef.get<readonly [typeof realStatus]>(SUBJECT)[0]
}

describe("HTTP_STATUS_BY_KIND", () => {
    it.each([
        ["invalid", 400],
        ["unauthenticated", 401],
        ["forbidden", 403],
        ["not-found", 404],
        ["conflict", 409],
        ["rate-limited", 429],
        ["unavailable", 503],
        ["internal", 500],
    ] as const)("answers a %s failure with HTTP %i", async (kind, status) => {
        const HTTP_STATUS_BY_KIND = await build()

        expect(HTTP_STATUS_BY_KIND[kind]).toBe(status)
    })
    it("maps every error kind and nothing else", async () => {
        const HTTP_STATUS_BY_KIND = await build()

        expect(Object.keys(HTTP_STATUS_BY_KIND)).toHaveLength(8)
    })
})
