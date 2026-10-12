import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { QUEUE_TRANSPORT } from "./queue.decorators"
import { QueueOutboxService } from "./queue-outbox.service"
import type { QueueTransport } from "./queue-transport.port"

const WORKSPACE = "3f0c7a52-8d1e-4b6a-9c2d-5e7f10a4b8c6"

const build = async () => {
    const transport = mock<QueueTransport>()
    transport.add.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [QueueOutboxService, { provide: QUEUE_TRANSPORT, useValue: transport }],
    }).compile()
    return { outbox: moduleRef.get(QueueOutboxService), transport }
}

describe("QueueOutboxService", () => {
    describe("write", () => {
        it("sends the job with the name and identity the producer chose and the workspace of its payload, in the transaction it is given", async () => {
            const { outbox, transport } = await build()
            const tx = fakeTransaction(mockEntityManager())

            await tx.em.transaction((manager) =>
                outbox.write(
                    manager,
                    "knowledge",
                    { sourceId: "s-1", workspaceId: WORKSPACE },
                    { job: "knowledge.index", dedupeKey: "knowledge.index:s-1" },
                ),
            )

            expect(transport.add).toHaveBeenCalledWith(expect.any(Object), {
                queue: "knowledge",
                job: "knowledge.index",
                dedupeKey: "knowledge.index:s-1",
                workspaceId: WORKSPACE,
                payload: { sourceId: "s-1", workspaceId: WORKSPACE },
            })
            expect(tx.commits).toBe(1)
        })

        it("names the job after the queue and leaves its identity to the database when the producer gives neither", async () => {
            const { outbox, transport } = await build()
            const tx = fakeTransaction(mockEntityManager())

            await tx.em.transaction((manager) => outbox.write(manager, "mail", { id: "m-1" }))

            expect(transport.add).toHaveBeenCalledWith(expect.any(Object), {
                queue: "mail",
                job: "mail",
                dedupeKey: null,
                workspaceId: null,
                payload: { id: "m-1" },
            })
        })

        it("leaves no job behind when the transaction rolls back", async () => {
            const { outbox } = await build()
            const tx = fakeTransaction(mockEntityManager())
            const failure = new Error("the change failed")

            await expect(
                tx.em.transaction(async (manager) => {
                    await outbox.write(manager, "mail", { id: "m-1" })
                    return Promise.reject(failure)
                }),
            ).rejects.toBe(failure)

            expect(tx.rollbacks).toBe(1)
            expect(tx.committedWrites).toEqual([])
        })

        it("rolls the change back when the queue refuses the job", async () => {
            const { outbox, transport } = await build()
            const tx = fakeTransaction(mockEntityManager())
            const failure = new Error("queue missing")
            transport.add.mockRejectedValue(failure)

            await expect(tx.em.transaction((manager) => outbox.write(manager, "mail", { id: "m-1" }))).rejects.toBe(
                failure,
            )

            expect(tx.rollbacks).toBe(1)
        })
    })
})
