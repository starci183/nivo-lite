import { IsNull, MoreThan, MoreThanOrEqual } from "typeorm"
import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import type { Secret } from "@modules/platform/config"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LoyaltyOtpsErrorCode } from "./errors/loyalty-otps.error"
import { LOYALTY_OTP_PEPPER } from "./loyalty-otps.decorators"
import { LoyaltyOtpsService } from "./loyalty-otps.service"
import { LoyaltyOtpEntity } from "./persistence/entities"
import { codeHash } from "./policies/otp.policy"

/** Hands a literal to an expectation as a plain object, so it is not mistaken for a hand-built entity row. */
const plain = (value: object): object => value

const NOW = Date.UTC(2026, 9, 12)
const PEPPER = "p".repeat(32)

const build = async (entityManager: MockEntityManager) => {
    const pepper = mock<Secret>()
    pepper.reveal.mockReturnValue(PEPPER)
    const moduleRef = await Test.createTestingModule({
        providers: [
            LoyaltyOtpsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LOYALTY_OTP_PEPPER, useValue: pepper },
        ],
    }).compile()
    return moduleRef.get(LoyaltyOtpsService)
}

const SINCE = "2026-10-11T00:00:00.000Z"

describe("LoyaltyOtpsService", () => {
    describe("counts", () => {
        it("count the codes of a workspace and of a customer since an instant", async () => {
            const entityManager = mockEntityManager({
                count: [
                    [LoyaltyOtpEntity, 4],
                    [LoyaltyOtpEntity, 2],
                ],
            })
            const otps = await build(entityManager)

            await expect(otps.workspaceCodesSince("ws-1", SINCE)).resolves.toBe(4)
            await expect(otps.customerCodesSince("c1", SINCE)).resolves.toBe(2)

            expect(entityManager.count.mock.calls).toEqual([
                [
                    LoyaltyOtpEntity,
                    plain({ where: { workspaceId: "ws-1", createdAt: MoreThanOrEqual(new Date(SINCE)) } }),
                ],
                [LoyaltyOtpEntity, plain({ where: { customerId: "c1", createdAt: MoreThanOrEqual(new Date(SINCE)) } })],
            ])
        })
    })

    describe("issue and discard", () => {
        it("stores the hash of a six-digit code and answers the plain code", async () => {
            const entityManager = mockEntityManager({ insert: [LoyaltyOtpEntity, { identifiers: [{ id: "o1" }] }] })
            const otps = await build(entityManager)

            const issued = await otps.issue("ws-1", "c1", "2026-10-12T00:10:00.000Z")

            expect(issued.id).toBe("o1")
            expect(issued.code).toMatch(/^\d{6}$/u)
            expect(entityManager.insert).toHaveBeenCalledWith(LoyaltyOtpEntity, {
                workspaceId: "ws-1",
                customerId: "c1",
                codeHash: codeHash(PEPPER, "c1", issued.code),
                expiresAt: new Date("2026-10-12T00:10:00.000Z"),
            })
        })

        it("fails when the store answers no row", async () => {
            const otps = await build(mockEntityManager({ insert: [LoyaltyOtpEntity, { identifiers: [] }] }))

            await expect(otps.issue("ws-1", "c1", "2026-10-12T00:10:00.000Z")).rejects.toMatchObject({
                code: LoyaltyOtpsErrorCode.NotIssued,
            })
        })

        it("drops a code", async () => {
            const entityManager = mockEntityManager({ delete: [LoyaltyOtpEntity, {}] })
            const otps = await build(entityManager)

            await otps.discard("o1")

            expect(entityManager.delete).toHaveBeenCalledWith(LoyaltyOtpEntity, { id: "o1" })
        })
    })
})

const OPEN_QUERY = [
    LoyaltyOtpEntity,
    {
        select: { id: true, codeHash: true, attempts: true },
        where: { customerId: "c1", usedAt: IsNull(), expiresAt: MoreThan(new Date(NOW)) },
        order: { createdAt: "DESC" },
    },
]

describe("LoyaltyOtpsService check", () => {
    const open = (attempts: number) =>
        Object.assign(new LoyaltyOtpEntity(), { id: "o1", codeHash: codeHash(PEPPER, "c1", "123456"), attempts })

    it("accepts the right code and uses it up", async () => {
        const entityManager = mockEntityManager({
            findOne: [LoyaltyOtpEntity, open(0)],
            update: [LoyaltyOtpEntity, {}],
        })
        const otps = await build(entityManager)

        await expect(otps.check("c1", "123456")).resolves.toBe("accepted")

        expect(entityManager.findOne.mock.calls).toEqual([OPEN_QUERY])
        expect(entityManager.update).toHaveBeenCalledWith(LoyaltyOtpEntity, { id: "o1" }, { usedAt: new Date(NOW) })
    })

    it("rejects a wrong code and counts the try", async () => {
        const entityManager = mockEntityManager({
            findOne: [LoyaltyOtpEntity, open(1)],
            increment: [LoyaltyOtpEntity, {}],
        })
        const otps = await build(entityManager)

        await expect(otps.check("c1", "000000")).resolves.toBe("rejected")

        expect(entityManager.increment).toHaveBeenCalledWith(LoyaltyOtpEntity, { id: "o1" }, "attempts", 1)
        expect(entityManager.update).not.toHaveBeenCalled()
    })

    it("rejects when no code is open or the tries are used up, even for the right code", async () => {
        const none = await build(mockEntityManager({ findOne: [LoyaltyOtpEntity, null] }))
        const spent = await build(mockEntityManager({ findOne: [LoyaltyOtpEntity, open(5)] }))

        await expect(none.check("c1", "123456")).resolves.toBe("rejected")
        await expect(spent.check("c1", "123456")).resolves.toBe("rejected")
    })
})
