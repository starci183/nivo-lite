import type { OptionalFence } from "./checkpoint-store.port"

/**
 * The fence rule of a checkpoint write, one function so the saver's store and its specs cannot drift apart. A thread is driven by
 * one worker at a time under a lease whose fence number rises each time the lease is taken; every row a driver writes carries its
 * fence. A write is refused when the thread already holds a newer fence: the writer was superseded and must not move the thread.
 * A writer with no fence is older than any fence, so it can never write over a driver's rows.
 *
 * @param writer - The fence of the writer's lease, or null when it holds none.
 * @param newest - The newest fence the thread holds (the lease row's, or the highest stored on its rows), or null when it holds none.
 * @returns True when the write must be refused.
 */
export const fencedOff = (writer: OptionalFence, newest: OptionalFence): boolean =>
    newest !== null && (writer === null || writer < newest)

/**
 * The newest of the fences a thread holds.
 *
 * @param fences - The fences found (a lease row's, the rows'), null where a row carries none.
 * @returns The highest number, or null when none is a number.
 */
export const newestFence = (fences: ReadonlyArray<OptionalFence>): OptionalFence =>
    fences.reduce<OptionalFence>(
        (newest, fence) => (fence !== null && (newest === null || fence > newest) ? fence : newest),
        null,
    )
