import type { ExecutionContext } from "@nestjs/common"
import { mock } from "@starci/jest-preset"
import { HttpSecurityErrorCode, RateLimit, RateLimitGuard, RateTier } from "@modules/platform/http-security"
import type { OperationRequest } from "@modules/platform/http-security"
import type {
    RateLimitAccessRow,
    RateLimitBucketRow,
    RateLimitProofAllowedRow,
    RateLimitProofHitsRow,
} from "../../fixtures/persistence/rate-limit.rows"
import {
    CLEAN_RATE_LIMIT_BUCKET,
    CONSUME_RATE_LIMIT_PROOF_BUCKET,
    EXPIRE_RATE_LIMIT_BUCKET,
    INSERT_RATE_LIMIT_PROOF_BUCKET,
    RATE_LIMIT_ACCESS,
    RATE_LIMIT_APP_ROLE,
    RATE_LIMIT_BUCKET,
    RUN_RATE_LIMIT_CLEANUP,
    UPDATE_RATE_LIMIT_PROOF_BUCKET,
} from "../../fixtures/persistence/rate-limit.sql"
import { RATE_LIMIT_PROOF_MODULES, sharedRateLimitStore } from "../../world/rate-limit-proof.module"
import { useTestWorld } from "../../world/use-test-world"

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
            await first.db.primary.query(CLEAN_RATE_LIMIT_BUCKET, [key])
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
        const rows = await first.db.primary.query<Array<RateLimitBucketRow>>(RATE_LIMIT_BUCKET, [key])
        expect(rows).toHaveLength(1)
        expect(rows[0]?.hits).toBe("24")
    })

    it("shares the strict budget and preserves its refusal code between replicas", async () => {
        const ip = first.key("strict")
        const key = `${RateTier.Strict}:${ip}`
        first.cleanup(async () => {
            await first.db.primary.query(CLEAN_RATE_LIMIT_BUCKET, [key])
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
            await first.db.primary.query(CLEAN_RATE_LIMIT_BUCKET, [key])
        })
        const firstStore = sharedRateLimitStore(first)
        const secondStore = sharedRateLimitStore(second)
        await firstStore.consume(key, 60_000, 2)
        await secondStore.consume(key, 60_000, 2)
        await expect(firstStore.consume(key, 60_000, 2)).resolves.toBe(false)
        await first.db.primary.query(EXPIRE_RATE_LIMIT_BUCKET, [key])

        const admitted = await Promise.all([firstStore.consume(key, 60_000, 2), secondStore.consume(key, 60_000, 2)])

        expect(admitted).toEqual([true, true])
        const rows = await second.db.primary.query<Array<RateLimitBucketRow>>(RATE_LIMIT_BUCKET, [key])
        expect(rows).toHaveLength(1)
        expect(rows[0]).toMatchObject({ hits: "2", active: true })
        await expect(secondStore.consume(key, 60_000, 2)).resolves.toBe(false)
    })

    it("cleans expired windows on another caller's request while preserving live counts and deadlines", async () => {
        const expired = first.key("cleanup-expired")
        const live = first.key("cleanup-live")
        const trigger = first.key("cleanup-trigger")
        first.cleanup(async () => {
            await first.db.primary.query(CLEAN_RATE_LIMIT_BUCKET, [expired])
            await first.db.primary.query(CLEAN_RATE_LIMIT_BUCKET, [live])
            await first.db.primary.query(CLEAN_RATE_LIMIT_BUCKET, [trigger])
        })
        const store = sharedRateLimitStore(first)
        await store.consume(expired, 60_000, 3)
        await store.consume(live, 60_000, 3)
        await first.db.primary.query(EXPIRE_RATE_LIMIT_BUCKET, [expired])
        const before = await first.db.primary.query<Array<RateLimitBucketRow>>(RATE_LIMIT_BUCKET, [live])

        await expect(sharedRateLimitStore(second).consume(trigger, 60_000, 3)).resolves.toBe(true)

        await expect(first.db.primary.query(RATE_LIMIT_BUCKET, [expired])).resolves.toEqual([])
        await expect(first.db.primary.query(RATE_LIMIT_BUCKET, [live])).resolves.toEqual(before)
    })
})

describe("Shared rate-limit database access", () => {
    it("lets the least-privilege backend count and clean windows while denying browser data and function access", async () => {
        const key = first.key("backend-privileges")
        first.cleanup(async () => {
            await first.db.primary.query(CLEAN_RATE_LIMIT_BUCKET, [key])
        })

        await first.db.primary.transaction(async (tx) => {
            await tx.query(RATE_LIMIT_APP_ROLE)
            await tx.query(INSERT_RATE_LIMIT_PROOF_BUCKET, [key])
            await expect(
                tx.query<Array<RateLimitProofHitsRow>>(UPDATE_RATE_LIMIT_PROOF_BUCKET, [key]),
            ).resolves.toEqual([{ hits: "2" }])
            const rows = await tx.query<Array<RateLimitBucketRow>>(RATE_LIMIT_BUCKET, [key])
            expect(rows).toHaveLength(1)
            expect(rows[0]).toMatchObject({ hits: "2", active: true })
            await expect(
                tx.query<Array<RateLimitProofAllowedRow>>(CONSUME_RATE_LIMIT_PROOF_BUCKET, [key, 60_000, 3]),
            ).resolves.toEqual([{ allowed: true }])
            await expect(
                tx.query<Array<RateLimitProofAllowedRow>>(CONSUME_RATE_LIMIT_PROOF_BUCKET, [key, 60_000, 3]),
            ).resolves.toEqual([{ allowed: false }])
            await tx.query(EXPIRE_RATE_LIMIT_BUCKET, [key])

            await tx.query(RUN_RATE_LIMIT_CLEANUP)

            await expect(tx.query(RATE_LIMIT_BUCKET, [key])).resolves.toEqual([])
            await expect(tx.query<Array<RateLimitAccessRow>>(RATE_LIMIT_ACCESS)).resolves.toEqual([
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
