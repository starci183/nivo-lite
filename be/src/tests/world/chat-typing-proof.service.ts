import type { EntityManager } from "typeorm"
import { SET_TYPING_RECEIVER_CONTEXT, USE_TYPING_RECEIVER_ROLE } from "../fixtures/persistence/chat-typing.sql"
import type { LiteWorld } from "./lite-world.service"

/** Applies a receiver's real JWT identity and role, then rolls the proof back even after an expected RLS refusal. */
export const withTypingReceiver = async (
    world: LiteWorld,
    userId: string,
    topic: string,
    proof: (manager: EntityManager) => Promise<void>,
): Promise<void> => {
    const runner = world.db.primary.connection.createQueryRunner()
    try {
        await runner.connect()
        await runner.startTransaction()
        await runner.manager.query(SET_TYPING_RECEIVER_CONTEXT, [userId, topic])
        await runner.manager.query(USE_TYPING_RECEIVER_ROLE)
        await proof(runner.manager)
    } finally {
        try {
            if (runner.isTransactionActive) await runner.rollbackTransaction()
        } finally {
            await runner.release()
        }
    }
}
