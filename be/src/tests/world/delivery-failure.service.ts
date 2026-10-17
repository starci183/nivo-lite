import type { LiteWorld } from "./lite-world.service"
import type { TestWorldError } from "./test-world.error"

/** Refuses one real commit so receipt completion and domain effects roll back before a successful retry. */
export const refuseNextDeliveryTransaction = (world: LiteWorld, failure: TestWorldError): void => {
    const failures = [failure]
    const connection = world.db.primary.connection
    const create = connection.createQueryRunner.bind(connection)
    jest.spyOn(connection, "createQueryRunner").mockImplementation((mode) => {
        const runner = create(mode)
        const commit = runner.commitTransaction.bind(runner)
        jest.spyOn(runner, "commitTransaction").mockImplementationOnce(async () => {
            const refusal = failures.pop()
            if (refusal !== undefined) throw refusal
            await commit()
        })
        return runner
    })
}
