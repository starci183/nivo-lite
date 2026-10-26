import { Test } from "@nestjs/testing"
import { fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import type { EntityManager } from "typeorm"
import { AfterCommitClient } from "./after-commit.client"

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [AfterCommitClient] }).compile()
    return moduleRef.get(AfterCommitClient)
}

/** Runs the body in a fake transaction and answers the manager the body received, as the subscribers of a connection see it. */
const inTransaction = (body: (manager: EntityManager) => Promise<void>): Promise<EntityManager> =>
    fakeTransaction(mockEntityManager()).em.transaction(async (manager) => {
        await body(manager)
        return manager
    })

describe("AfterCommitClient", () => {
    it("runs the task at once when the manager is not inside a transaction", async () => {
        const client = await build()
        const task = jest.fn().mockResolvedValue(undefined)

        await client.run(mockEntityManager(), task)

        expect(task).toHaveBeenCalledTimes(1)
    })

    it("holds the task while the transaction is open and runs it after the commit", async () => {
        const client = await build()
        const order: Array<string> = []

        const manager = await inTransaction(async (inside) => {
            await client.run(inside, () => Promise.resolve(void order.push("task")))
            order.push("inside the transaction")
        })
        order.push("before commit")
        await client.commit(manager)
        order.push("after commit")

        expect(order).toEqual(["inside the transaction", "before commit", "task", "after commit"])
    })

    it("runs every held task of the transaction once, in the order they were held", async () => {
        const client = await build()
        const order: Array<string> = []

        const manager = await inTransaction(async (inside) => {
            await client.run(inside, () => Promise.resolve(void order.push("first")))
            await client.run(inside, () => Promise.resolve(void order.push("second")))
        })
        await client.commit(manager)
        await client.commit(manager)

        expect(order).toEqual(["first", "second"])
    })

    it("drops the held tasks when the transaction rolls back", async () => {
        const client = await build()
        const task = jest.fn().mockResolvedValue(undefined)

        const manager = await inTransaction((inside) => client.run(inside, task))
        client.rollback(manager)
        await client.commit(manager)

        expect(task).not.toHaveBeenCalled()
    })

    it("keeps the tasks of one transaction apart from another", async () => {
        const client = await build()
        const mine = jest.fn().mockResolvedValue(undefined)
        const other = jest.fn().mockResolvedValue(undefined)

        const first = await inTransaction((inside) => client.run(inside, mine))
        await inTransaction((inside) => client.run(inside, other))
        await client.commit(first)

        expect(mine).toHaveBeenCalledTimes(1)
        expect(other).not.toHaveBeenCalled()
    })
})
