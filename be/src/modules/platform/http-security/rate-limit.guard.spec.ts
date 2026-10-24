import type { ExecutionContext } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import type { Request } from "express"
import { RATE_LIMIT_STORE } from "@modules/platform/database"
import type { RateLimitStore } from "@modules/platform/database"
import { HttpSecurityErrorCode } from "./errors/http-security.error"
import { HTTP_SECURITY_OPTIONS } from "./http-security.decorators"
import type { HttpSecurityOptions } from "./http-security.options"
import { RateLimit, RateLimitGuard, RateTier } from "./rate-limit.guard"

const OPTIONS: HttpSecurityOptions = {
    trustedProxyHops: 1,
    allowedOrigins: [],
    rateLimit: { windowMs: 60_000, defaultLimit: 3, strictLimit: 1 },
    webhooks: {},
}

class Door {}

const defaultHandler = (): void => undefined
const strictHandler = (): void => undefined
RateLimit(RateTier.Strict)(strictHandler)

const build = async (handler = defaultHandler) => {
    let ip: string | undefined = "127.0.0.1"
    const callFrom = (address: string | undefined): void => {
        ip = address
    }
    const http = mock<ReturnType<ExecutionContext["switchToHttp"]>>()
    http.getRequest.mockImplementation(() => mock<Request>({ ip }))
    const context = mock<ExecutionContext>()
    context.getHandler.mockReturnValue(handler)
    context.getClass.mockReturnValue(Door)
    context.switchToHttp.mockReturnValue(http)
    const store = mock<RateLimitStore>()
    store.consume.mockResolvedValue(true)
    const moduleRef = await Test.createTestingModule({
        providers: [
            RateLimitGuard,
            Reflector,
            { provide: RATE_LIMIT_STORE, useValue: store },
            { provide: HTTP_SECURITY_OPTIONS, useValue: builder<HttpSecurityOptions>(OPTIONS)() },
        ],
    }).compile()
    return { guard: moduleRef.get(RateLimitGuard), context, store, callFrom }
}

describe("RateLimitGuard", () => {
    it("counts the caller in the shared store with the existing default tier and window", async () => {
        const { guard, context, store } = await build()

        await expect(guard.canActivate(context)).resolves.toBe(true)

        expect(store.consume.mock.calls).toEqual([["default:127.0.0.1", 60_000, 3]])
    })

    it("applies the strict limit to a door marked strict", async () => {
        const { guard, context, store } = await build(strictHandler)

        await expect(guard.canActivate(context)).resolves.toBe(true)

        expect(store.consume.mock.calls).toEqual([["strict:127.0.0.1", 60_000, 1]])
    })

    it("uses each caller address on its own and one unknown bucket for absent addresses", async () => {
        const { guard, context, store, callFrom } = await build()

        await guard.canActivate(context)
        callFrom("10.0.0.2")
        await guard.canActivate(context)
        callFrom(undefined)
        await guard.canActivate(context)

        expect(store.consume.mock.calls).toEqual([
            ["default:127.0.0.1", 60_000, 3],
            ["default:10.0.0.2", 60_000, 3],
            ["default:unknown", 60_000, 3],
        ])
    })

    it("refuses an exhausted shared bucket with the existing error code", async () => {
        const { guard, context, store } = await build()
        store.consume.mockResolvedValue(false)

        await expect(guard.canActivate(context)).rejects.toMatchObject({
            code: HttpSecurityErrorCode.RateLimited,
        })
    })

    it("propagates a store failure without admitting the request", async () => {
        const { guard, context, store } = await build()
        const failure = new Error("database unavailable")
        store.consume.mockRejectedValue(failure)

        await expect(guard.canActivate(context)).rejects.toBe(failure)
    })
})
