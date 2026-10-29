import type { ExecutionContext } from "@nestjs/common"
import { mock } from "@starci/jest-preset"
import { HttpSecurityErrorCode, RateLimit, RateLimitGuard, RateTier } from "@modules/platform/http-security"
import type { OperationRequest } from "@modules/platform/http-security"
import { RATE_LIMIT_PROOF_MODULES, sharedRateLimitStore } from "../../world/rate-limit-proof.module"
import { insertRateLimitProofBucket } from "../../fixtures/builders/rate-limit.builder"
import { withBackendRole } from "../../world/backend-role-proof.service"
import { useTestWorld } from "../../world/use-test-world"
import {
    rateLimitBucket,
    expireRateLimitBucket,
    cleanRateLimitBucket,
    runRateLimitCleanup,
    updateRateLimitProofBucket,
    consumeRateLimitProofBucket,
    rateLimitAccess,
} from "../../world/rate-limit-database.service"

class Door {
    readonly purpose = "a controller class the rate-limit guard reads its tier from"
}

const defaultHandler = (): void => undefined
const strictHandler = (): void => undefined
RateLimit(RateTier.Strict)(strictHandler)

const contextOf = (ip: string, handler = defaultHandler): ExecutionContext => {
    const request = mock<OperationRequest>({ ip })
    const http = mock<ReturnType<ExecutionContext["switchToHttp"]>>()
    http.getRequest.mockReturnValue(request)
    const context = mock<ExecutionContext>()
    context.getHandler.mockReturnValue(handler)
    context.getClass.mockReturnValue(Door)
    context.switchToHttp.mockReturnValue(http)
    return context
}

const first = useTestWorld({ modules: RATE_LIMIT_PROOF_MODULES })
const second = useTestWorld({ modules: RATE_LIMIT_PROOF_MODULES })

describe("HTTP rate limits shared by PostgreSQL replicas", () => {
    it("admits exactly the default budget across concurrent requests to two independently composed guards", async () => {
        const ip = first.key("concurrent")
        const key = `${RateTier.Default}:${ip}`
        first.cleanup(async () => {
            await cleanRateLimitBucket(first.db.primary, key)
        })
        const firstStore = sharedRateLimitStore(first)
        const secondStore = sharedRateLimitStore(second)
        const firstGuard = first.resolve(RateLimitGuard)
        const secondGuard = second.resolve(RateLimitGuard)
        const context = contextOf(ip)

        const outcomes = await Promise.all(
            Array.from({ length: 24 }, (_, index) => {
                const guard = index % 2 === 0 ? firstGuard : secondGuard
                return guard.canActivate(context).then(
                    (allowed) => allowed,
                    (cause: unknown) => cause,
                )
            }),
        )

        expect(firstStore).not.toBe(secondStore)
        expect(firstGuard).not.toBe(secondGuard)
        expect(outcomes.filter((outcome) => outcome === true)).toHaveLength(3)
        expect(outcomes.filter((outcome) => outcome !== true)).toHaveLength(21)
        for (const outcome of outcomes.filter((result) => result !== true)) {
            expect(outcome).toMatchObject({ code: HttpSecurityErrorCode.RateLimited })
        }
        const rows = await rateLimitBucket(first.db.primary, key)
        expect(rows).toHaveLength(1)
        expect(rows[0]?.hits).toBe("24")
    })

    it("shares the strict budget and preserves its refusal code between replicas", async () => {
        const ip = first.key("strict")
        const key = `${RateTier.Strict}:${ip}`
        first.cleanup(async () => {
            await cleanRateLimitBucket(first.db.primary, key)
        })
        const context = contextOf(ip, strictHandler)

        await expect(first.resolve(RateLimitGuard).canActivate(context)).resolves.toBe(true)
        await expect(second.resolve(RateLimitGuard).canActivate(context)).rejects.toMatchObject({
            code: HttpSecurityErrorCode.RateLimited,
        })
    })
})

describe("Shared rate-limit window lifecycle", () => {
    it("starts one new shared window at expiry without losing simultaneous rollover increments", async () => {
        const key = first.key("rollover")
        first.cleanup(async () => {
            await cleanRateLimitBucket(first.db.primary, key)
        })
        const firstStore = sharedRateLimitStore(first)
        const secondStore = sharedRateLimitStore(second)
        await firstStore.consume(key, 60_000, 2)
        await secondStore.consume(key, 60_000, 2)
        await expect(firstStore.consume(key, 60_000, 2)).resolves.toBe(false)
        await expireRateLimitBucket(first.db.primary, key)

        const admitted = await Promise.all([firstStore.consume(key, 60_000, 2), secondStore.consume(key, 60_000, 2)])

        expect(admitted).toEqual([true, true])
        const rows = await rateLimitBucket(second.db.primary, key)
        expect(rows).toHaveLength(1)
        expect(rows[0]).toMatchObject({ hits: "2", active: true })
        await expect(secondStore.consume(key, 60_000, 2)).resolves.toBe(false)
    })

    it("cleans expired windows on another caller's request while preserving live counts and deadlines", async () => {
        const expired = first.key("cleanup-expired")
        const live = first.key("cleanup-live")
        const trigger = first.key("cleanup-trigger")
        first.cleanup(async () => {
            await cleanRateLimitBucket(first.db.primary, expired)
            await cleanRateLimitBucket(first.db.primary, live)
            await cleanRateLimitBucket(first.db.primary, trigger)
        })
        const store = sharedRateLimitStore(first)
        await store.consume(expired, 60_000, 3)
        await store.consume(live, 60_000, 3)
        await expireRateLimitBucket(first.db.primary, expired)
        const before = await rateLimitBucket(first.db.primary, live)

        await expect(sharedRateLimitStore(second).consume(trigger, 60_000, 3)).resolves.toBe(true)

        await expect(rateLimitBucket(first.db.primary, expired)).resolves.toEqual([])
        await expect(rateLimitBucket(first.db.primary, live)).resolves.toEqual(before)
    })
})

describe("Shared rate-limit database access", () => {
    it("lets the least-privilege backend count and clean windows while denying browser data and function access", async () => {
        const key = first.key("backend-privileges")
        first.cleanup(async () => {
            await cleanRateLimitBucket(first.db.primary, key)
        })

        await withBackendRole(first, async (tx) => {
            await insertRateLimitProofBucket(tx, key)
            await expect(updateRateLimitProofBucket(tx, key)).resolves.toEqual([{ hits: "2" }])
            const rows = await rateLimitBucket(tx, key)
            expect(rows).toHaveLength(1)
            expect(rows[0]).toMatchObject({ hits: "2", active: true })
            await expect(consumeRateLimitProofBucket(tx, key, 60_000, 3)).resolves.toEqual([{ allowed: true }])
            await expect(consumeRateLimitProofBucket(tx, key, 60_000, 3)).resolves.toEqual([{ allowed: false }])
            await expireRateLimitBucket(tx, key)

            await runRateLimitCleanup(tx)

            await expect(rateLimitBucket(tx, key)).resolves.toEqual([])
            await expect(rateLimitAccess(tx)).resolves.toEqual([
                {
                    anonymous_data: false,
                    authenticated_data: false,
                    anonymous_cleanup: false,
                    authenticated_cleanup: false,
                    backend_cleanup: true,
                    anonymous_consume: false,
                    authenticated_consume: false,
                    backend_consume: true,
                },
            ])
        })
    })
})
