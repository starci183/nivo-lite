import { Test } from "@nestjs/testing"
import { FakeClock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LoyaltyOtpsErrorCode } from "./errors/loyalty-otps.error"
import { LOYALTY_OTP_PEPPER } from "./loyalty-otps.decorators"
import { LoyaltyOtpsService } from "./loyalty-otps.service"
import {
    BUMP_ATTEMPTS,
    COUNT_CUSTOMER_CODES,
    COUNT_WORKSPACE_CODES,
    DELETE_CODE,
    INSERT_CODE,
    MARK_USED,
    SELECT_OPEN_CODE,
} from "./persistence/loyalty-otps.sql"
import { codeHash } from "./policies/otp.policy"

const NOW = Date.UTC(2026, 9, 12)
const PEPPER = "pepper"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            LoyaltyOtpsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LOYALTY_OTP_PEPPER, useValue: PEPPER },
        ],
    }).compile()
    return moduleRef.get(LoyaltyOtpsService)
}

describe("LoyaltyOtpsService", () => {
    describe("counts", () => {
        it("count the codes of a workspace and of a customer since an instant", async () => {
            const otps = await build(
                mockEntityManager({
                    query: [
                        [COUNT_WORKSPACE_CODES, [{ total: 4 }]],
                        [COUNT_CUSTOMER_CODES, [{ total: 2 }]],
                    ],
                }),
            )

            await expect(otps.workspaceCodesSince("ws-1", "2026-10-11T00:00:00.000Z")).resolves.toBe(4)
            await expect(otps.customerCodesSince("c1", "2026-10-11T00:00:00.000Z")).resolves.toBe(2)
        })
    })

    describe("issue and discard", () => {
        it("stores the hash of a six-digit code and answers the plain code", async () => {
            const entityManager = mockEntityManager({ query: [INSERT_CODE, [{ id: "o1" }]] })
            const otps = await build(entityManager)

            const issued = await otps.issue("ws-1", "c1", "2026-10-12T00:10:00.000Z")

            expect(issued.id).toBe("o1")
            expect(issued.code).toMatch(/^\d{6}$/u)
            expect(entityManager.query).toHaveBeenCalledWith(INSERT_CODE, [
                "ws-1",
                "c1",
                codeHash(PEPPER, "c1", issued.code),
                "2026-10-12T00:10:00.000Z",
            ])
        })

        it("fails when the store answers no row", async () => {
            const otps = await build(mockEntityManager({ query: [INSERT_CODE, []] }))

            await expect(otps.issue("ws-1", "c1", "2026-10-12T00:10:00.000Z")).rejects.toMatchObject({
                code: LoyaltyOtpsErrorCode.NotIssued,
            })
        })

        it("drops a code", async () => {
            const entityManager = mockEntityManager({ query: [DELETE_CODE, []] })
            const otps = await build(entityManager)

            await otps.discard("o1")

            expect(entityManager.query).toHaveBeenCalledWith(DELETE_CODE, ["o1"])
        })
    })

    describe("check", () => {
        const open = (attempts: number) => ({ id: "o1", code_hash: codeHash(PEPPER, "c1", "123456"), attempts })

        it("accepts the right code and uses it up", async () => {
            const entityManager = mockEntityManager({
                query: [
                    [SELECT_OPEN_CODE, [open(0)]],
                    [MARK_USED, []],
                ],
            })
            const otps = await build(entityManager)

            await expect(otps.check("c1", "123456")).resolves.toBe("accepted")

            expect(entityManager.query).toHaveBeenCalledWith(MARK_USED, ["o1", new Date(NOW).toISOString()])
        })

        it("rejects a wrong code and counts the try", async () => {
            const entityManager = mockEntityManager({
                query: [
                    [SELECT_OPEN_CODE, [open(1)]],
                    [BUMP_ATTEMPTS, []],
                ],
            })
            const otps = await build(entityManager)

            await expect(otps.check("c1", "000000")).resolves.toBe("rejected")

            expect(entityManager.query).toHaveBeenCalledWith(BUMP_ATTEMPTS, ["o1"])
        })

        it("rejects when no code is open or the tries are used up, even for the right code", async () => {
            const none = await build(mockEntityManager({ query: [SELECT_OPEN_CODE, []] }))
            const spent = await build(mockEntityManager({ query: [SELECT_OPEN_CODE, [open(5)]] }))

            await expect(none.check("c1", "123456")).resolves.toBe("rejected")
            await expect(spent.check("c1", "123456")).resolves.toBe("rejected")
        })
    })
})
