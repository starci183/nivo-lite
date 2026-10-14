import { mock } from "@starci/jest-preset"
import type { Request, Response } from "express"
import { securityHeadersMiddleware } from "./security-headers.policy"

describe("securityHeadersMiddleware", () => {
    it("sets the exact security headers and continues the middleware chain once", () => {
        const request = mock<Request>()
        const response = mock<Response>()
        const next = jest.fn()

        securityHeadersMiddleware()(request, response, next)

        expect(response.setHeader.mock.calls).toEqual([
            ["Strict-Transport-Security", "max-age=31536000; includeSubDomains"],
            ["X-Content-Type-Options", "nosniff"],
            ["Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'"],
            ["Referrer-Policy", "no-referrer"],
            ["Cross-Origin-Resource-Policy", "same-site"],
        ])
        expect(next).toHaveBeenCalledTimes(1)
        expect(next).toHaveBeenCalledWith()
    })
})
