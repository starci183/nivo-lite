import assert from "node:assert/strict"
import type { EntityManager } from "typeorm"
import { BACKEND_ROLE, ENTER_BACKEND_ROLE, USE_BACKEND_ROLE } from "./backend-role.sql"
import type { LiteWorld } from "./lite-world.service"

/** Exercises the backend's real privileges and rolls back both the local role membership and the proof's writes. */
export const withBackendRole = async (
    world: LiteWorld,
    proof: (manager: EntityManager) => Promise<void>,
): Promise<void> => {
    const runner = world.db.primary.connection.createQueryRunner()
    try {
        await runner.connect()
        await runner.startTransaction()
        await runner.manager.query(ENTER_BACKEND_ROLE)
        await runner.manager.query(USE_BACKEND_ROLE)
        const roles = await runner.manager.query<Array<{ role: string }>>(BACKEND_ROLE)
        assert.deepEqual(roles, [{ role: "app_be" }], "The backend privilege proof must execute as app_be")
        await proof(runner.manager)
    } finally {
        try {
            if (runner.isTransactionActive) await runner.rollbackTransaction()
        } finally {
            await runner.release()
        }
    }
}
