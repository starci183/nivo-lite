import { Test } from "@nestjs/testing"
import { fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import { QueueOutboxService } from "./queue-outbox.service"

const ENQUEUE = "SELECT * FROM public.job_enqueue($1, $2, $3, $4, $5)"
const MINT = "SELECT * FROM gen_random_uuid()"

const WORKSPACE = "3f0c7a52-8d1e-4b6a-9c2d-5e7f10a4b8c6"

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [QueueOutboxService] }).compile()
    return moduleRef.get(QueueOutboxService)
}

describe("QueueOutboxService", () => {
    describe("write", () => {
        it("inserts only the durable row, with the name and identity the producer chose and the workspace of its payload, in the transaction it is given", async () => {
            const outbox = await build()
            const tx = fakeTransaction(mockEntityManager({ query: [[ENQUEUE, [{ job_enqueue: "row-1" }]]] }))

            await tx.em.transaction((manager) =>
                outbox.write(
                    manager,
                    "knowledge",
                    { sourceId: "s-1", workspaceId: WORKSPACE },
                    { job: "knowledge.index", dedupeKey: "knowledge.index:s-1" },
                ),
            )

            expect(tx.em.query).toHaveBeenCalledTimes(1)
            expect(tx.em.query).toHaveBeenCalledWith(ENQUEUE, [
                WORKSPACE,
                "knowledge",
                "knowledge.index",
                JSON.stringify({ sourceId: "s-1", workspaceId: WORKSPACE }),
                "knowledge.index:s-1",
            ])
            expect(tx.commits).toBe(1)
        })

        it("names the job after the queue and leaves its workspace null, and gives a job with no identity a fresh one the database mints", async () => {
            const outbox = await build()
            const tx = fakeTransaction(
                mockEntityManager({
                    query: [
                        [MINT, [{ gen_random_uuid: "9d1c6e0e-3a54-4c53-8d16-0f2f6c1d7a11" }]],
                        [ENQUEUE, [{ job_enqueue: "row-1" }]],
                    ],
                }),
            )

            await tx.em.transaction((manager) => outbox.write(manager, "mail", { id: "m-1" }))

            expect(tx.em.query).toHaveBeenNthCalledWith(1, MINT, [])
            expect(tx.em.query).toHaveBeenNthCalledWith(2, ENQUEUE, [
                null,
                "mail",
                "mail",
                JSON.stringify({ id: "m-1" }),
                "mail:9d1c6e0e-3a54-4c53-8d16-0f2f6c1d7a11",
            ])
        })

        it("leaves no job behind when the transaction rolls back, and never touches the broker", async () => {
            const outbox = await build()
            const tx = fakeTransaction(
                mockEntityManager({
                    query: [
                        [MINT, [{ gen_random_uuid: "u-1" }]],
                        [ENQUEUE, [{ job_enqueue: "row-1" }]],
                    ],
                }),
            )
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
