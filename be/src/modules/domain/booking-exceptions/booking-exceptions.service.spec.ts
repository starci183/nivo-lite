import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { BookingExceptionCreateParams } from "./booking-exceptions.contracts"
import { BookingExceptionsService } from "./booking-exceptions.service"
import { DELETE_SETUP_EXCEPTION, INSERT_SETUP_EXCEPTION } from "./persistence/booking-exceptions.sql"

const PARAMS: BookingExceptionCreateParams = {
    workspaceId: "ws-1",
    resourceId: "resource-1",
    date: "2026-10-20",
    closed: true,
    start: null,
    end: null,
    note: "holiday",
}

const SAVED = [{ id: "exception-1" }]

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [BookingExceptionsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(BookingExceptionsService)
}

describe("BookingExceptionsService", () => {
    it("inserts the exception on the injected manager", async () => {
        const entityManager = mockEntityManager({ query: [INSERT_SETUP_EXCEPTION, SAVED] })
        const exceptions = await build(entityManager)

        await expect(exceptions.create(PARAMS)).resolves.toEqual(SAVED)
        expect(entityManager.query).toHaveBeenCalledWith(INSERT_SETUP_EXCEPTION, [
            "ws-1",
            "resource-1",
            "2026-10-20",
            true,
            null,
            null,
            "holiday",
        ])
    })

    it("writes through the manager the coordinator hands in", async () => {
        const handed = mockEntityManager({ query: [INSERT_SETUP_EXCEPTION, SAVED] })
        const exceptions = await build(mockEntityManager())

        await expect(exceptions.create(PARAMS, handed)).resolves.toEqual(SAVED)
        expect(handed.query).toHaveBeenCalledWith(INSERT_SETUP_EXCEPTION, [
            "ws-1",
            "resource-1",
            "2026-10-20",
            true,
            null,
            null,
            "holiday",
        ])
    })

    it("removes an exception of the workspace", async () => {
        const entityManager = mockEntityManager({ query: [DELETE_SETUP_EXCEPTION, SAVED] })
        const exceptions = await build(entityManager)

        await expect(exceptions.remove("ws-1", "exception-1")).resolves.toEqual(SAVED)
        expect(entityManager.query).toHaveBeenCalledWith(DELETE_SETUP_EXCEPTION, ["ws-1", "exception-1"])
    })
})
