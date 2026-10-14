import type { RequestHandler } from "express"

/** Applies the API's security headers to every response before continuing the middleware chain. */
export const securityHeadersMiddleware = (): RequestHandler => (_request, response, next) => {
    response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    response.setHeader("X-Content-Type-Options", "nosniff")
    response.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
    response.setHeader("Referrer-Policy", "no-referrer")
    response.setHeader("Cross-Origin-Resource-Policy", "same-site")
    next()
}
