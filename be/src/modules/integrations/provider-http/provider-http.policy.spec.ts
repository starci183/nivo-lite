import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { cutDetail as cutDetailSubject, multipartOf as multipartOfSubject, retryAfterSecondsOf as retryAfterSecondsOfSubject, statusClassOf as statusClassOfSubject } from "./provider-http.policy"


const SUBJECT = Symbol("provider-http.policy")

const build = async (): Promise<{ cutDetail: typeof cutDetailSubject; multipartOf: typeof multipartOfSubject; retryAfterSecondsOf: typeof retryAfterSecondsOfSubject; statusClassOf: typeof statusClassOfSubject }> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: mock<{ cutDetail: typeof cutDetailSubject; multipartOf: typeof multipartOfSubject; retryAfterSecondsOf: typeof retryAfterSecondsOfSubject; statusClassOf: typeof statusClassOfSubject }>({ cutDetail: cutDetailSubject, multipartOf: multipartOfSubject, retryAfterSecondsOf: retryAfterSecondsOfSubject, statusClassOf: statusClassOfSubject }) }],
    }).compile()
    return moduleRef.get<{ cutDetail: typeof cutDetailSubject; multipartOf: typeof multipartOfSubject; retryAfterSecondsOf: typeof retryAfterSecondsOfSubject; statusClassOf: typeof statusClassOfSubject }>(SUBJECT)
}

describe("statusClassOf", () => {
    let statusClassOf: typeof statusClassOfSubject

    beforeAll(async () => {
        ;({ statusClassOf } = await build())
    })

    it.each([
        [200, "ok"],
        [204, "ok"],
        [401, "auth"],
        [403, "auth"],
        [404, "not_found"],
        [429, "rate_limited"],
        [400, "rejected"],
        [402, "rejected"],
        [422, "rejected"],
        [500, "server"],
        [503, "server"],
        [302, "server"],
    ])("classes %i as %s, by the number alone", (status, expected) => {
        expect(statusClassOf(status)).toBe(expected)
    })
})

describe("retryAfterSecondsOf", () => {
    let retryAfterSecondsOf: typeof retryAfterSecondsOfSubject

    beforeAll(async () => {
        ;({ retryAfterSecondsOf } = await build())
    })

    it("reads seconds, and 0 for none or a date", () => {
        expect(retryAfterSecondsOf({ "retry-after": "2.5" })).toBe(3)
        expect(retryAfterSecondsOf({})).toBe(0)
        expect(retryAfterSecondsOf(undefined)).toBe(0)
        expect(retryAfterSecondsOf({ "retry-after": "Wed, 21 Oct 2026 07:28:00 GMT" })).toBe(0)
    })
})

describe("cutDetail", () => {
    let cutDetail: typeof cutDetailSubject

    beforeAll(async () => {
        ;({ cutDetail } = await build())
    })

    it("keeps a trimmed text up to its bound, else null", () => {
        expect(cutDetail("  no  ")).toBe("no")
        expect(cutDetail("x".repeat(400))).toHaveLength(300)
        expect(cutDetail(7)).toBeNull()
        expect(cutDetail("   ")).toBeNull()
    })
})

describe("multipartOf", () => {
    let multipartOf: typeof multipartOfSubject

    beforeAll(async () => {
        ;({ multipartOf } = await build())
    })

    it("writes one part per field in order, closed by the boundary (RFC 7578)", () => {
        const body = multipartOf(
            [
                { name: "a", value: "1" },
                { name: "b", value: "two words" },
            ],
            "B",
        )

        expect(body.contentType).toBe("multipart/form-data; boundary=B")
        expect(body.bytes.toString("utf8")).toBe(
            '--B\r\nContent-Disposition: form-data; name="a"\r\n\r\n1\r\n' +
                '--B\r\nContent-Disposition: form-data; name="b"\r\n\r\ntwo words\r\n--B--\r\n',
        )
    })

    it("draws a fresh boundary when none is given", () => {
        expect(multipartOf([]).contentType).not.toBe(multipartOf([]).contentType)
    })
})
