import { Test } from "@nestjs/testing"
import { fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import { QueueOutboxService } from "./queue-outbox.service"
import { JOB_ENQUEUE } from "./persistence/queue.sql"

const WORKSPACE = "3f0c7a52-8d1e-4b6a-9c2d-5e7f10a4b8c6"

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [QueueOutboxService] }).compile()
    return moduleRef.get(QueueOutboxService)
}

describe("QueueOutboxService", () => {
    describe("write", () => {
        it("inserts only the durable row, with the name and identity the producer chose and the workspace of its payload, in the transaction it is given", async () => {
            const outbox = await build()
            const tx = fakeTransaction(mockEntityManager({ query: [[JOB_ENQUEUE, [{ id: "row-1" }]]] }))

            await tx.em.transaction((manager) =>
                outbox.write(
                    manager,
                    "knowledge",
                    { sourceId: "s-1", workspaceId: WORKSPACE },
                    { job: "knowledge.index", dedupeKey: "knowledge.index:s-1" },
                ),
            )

            expect(tx.em.query).toHaveBeenCalledTimes(1)
            expect(tx.em.query).toHaveBeenCalledWith(JOB_ENQUEUE, [
                WORKSPACE,
                "knowledge",
                "knowledge.index",
                JSON.stringify({ sourceId: "s-1", workspaceId: WORKSPACE }),
                "knowledge.index:s-1",
            ])
            expect(tx.commits).toBe(1)
        })

        it("names the job after the queue and leaves its identity and workspace null when the producer gives neither", async () => {
            const outbox = await build()
            const tx = fakeTransaction(mockEntityManager({ query: [[JOB_ENQUEUE, [{ id: "row-1" }]]] }))

            await tx.em.transaction((manager) => outbox.write(manager, "mail", { id: "m-1" }))

            expect(tx.em.query).toHaveBeenCalledWith(JOB_ENQUEUE, [
                null,
                "mail",
                "mail",
                JSON.stringify({ id: "m-1" }),
                null,
            ])
        })

        it("leaves no job behind when the transaction rolls back, and never touches the broker", async () => {
            const outbox = await build()
            const tx = fakeTransaction(mockEntityManager({ query: [[JOB_ENQUEUE, [{ id: "row-1" }]]] }))
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
    })
})
