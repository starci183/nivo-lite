import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BookingExceptionsService } from "./booking-exceptions.service"
import { BookingExceptionEntity } from "./persistence/entities"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [BookingExceptionsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(BookingExceptionsService)
}

describe("BookingExceptionsService", () => {
    describe("create", () => {
        it("writes a closed day of a resource and answers its id", async () => {
            const em = mockEntityManager({
                save: [BookingExceptionEntity, Object.assign(new BookingExceptionEntity(), { id: "ex-1" })],
            })
            const exceptions = await build(em)

            const saved = await exceptions.create({
                workspaceId: "ws-1",
                resourceId: "r-1",
                date: "2026-10-20",
                closed: true,
                start: null,
                end: null,
                note: "Holiday",
            })

            expect(saved).toEqual([{ id: "ex-1" }])
            expect(em.save).toHaveBeenCalledWith(
                BookingExceptionEntity,
                expect.objectContaining({
                    workspaceId: "ws-1",
                    resourceId: "r-1",
                    onDate: "2026-10-20",
                    closed: true,
                    startTime: null,
                    endTime: null,
                    note: "Holiday",
                }),
            )
        })

        it("writes through the manager of the caller's transaction", async () => {
            const own = mockEntityManager()
            const caller = mockEntityManager({
                save: [BookingExceptionEntity, Object.assign(new BookingExceptionEntity(), { id: "ex-2" })],
            })
            const exceptions = await build(own)

            await expect(
                exceptions.create(
                    {
                        workspaceId: "ws-1",
                        resourceId: null,
                        date: "2026-10-21",
                        closed: false,
                        start: "10:00",
                        end: "14:00",
                        note: "",
                    },
                    caller,
                ),
            ).resolves.toEqual([{ id: "ex-2" }])
            expect(own.save).not.toHaveBeenCalled()
        })
    })

    describe("remove", () => {
        it("removes an exception of the workspace and answers its id, or nothing when it is not there", async () => {
            const em = mockEntityManager({
                delete: [
                    [BookingExceptionEntity, { affected: 1 }],
                    [BookingExceptionEntity, { affected: 0 }],
                ],
            })
            const exceptions = await build(em)

            await expect(exceptions.remove("ws-1", "ex-1")).resolves.toEqual([{ id: "ex-1" }])
            await expect(exceptions.remove("ws-1", "ex-9")).resolves.toEqual([])
            expect(em.delete).toHaveBeenLastCalledWith(BookingExceptionEntity, { workspaceId: "ws-1", id: "ex-9" })
        })

        it("answers nothing when the delete reports no affected count", async () => {
            const em = mockEntityManager({ delete: [BookingExceptionEntity, {}] })
            const exceptions = await build(em)

            await expect(exceptions.remove("ws-1", "ex-1")).resolves.toEqual([])
        })
    })
})
