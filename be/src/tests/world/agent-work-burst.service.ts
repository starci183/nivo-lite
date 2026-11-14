import type { EntityManager } from "typeorm"

/**
 * Moves a wake's `not_before` `ms` into the future by the database clock: what a drain sees when the database clock was stepped back
 * between the wake's commit and the drain's read (D-MX-5: a container VM's time sync does this on dev).
 */
export const dueLater = async (manager: EntityManager, wakeId: string, ms: number): Promise<void> => {
    await manager.query(
        "UPDATE public.agent_wakes SET not_before = now() + make_interval(secs => $2::numeric / 1000) WHERE id = $1",
        [wakeId, ms],
    )
}
