/** A piece of work that waits for its turn at the gate. */
type GatedWork<Result> = () => Promise<Result>

/** What a gate shares between the pieces of work that pass it: how many are running and who waits, in the order they came. */
interface GateState {
    /** The pieces of work running now. */
    running: number
    /** The turns of the pieces of work that wait, each a resolver that lets one start. */
    readonly waiting: Array<() => void>
}

/** A door that lets at most `limit` pieces of work through at once; the others wait their turn, in the order they came. */
export interface ConcurrencyGate {
    /** Runs `work` when a place is free and answers what it answered; the place is given back when `work` settles, whether it resolved or threw. */
    run<Result>(work: GatedWork<Result>): Promise<Result>
}

/**
 * A gate for one process: it caps the calls of a slow, paid dependency (a model) so that many jobs started together do not all wait on it at once and
 * time out together. A limit below 1 is read as 1, so the gate never closes for good.
 */
export const concurrencyGateOf = (limit: number): ConcurrencyGate => {
    const places = Math.max(1, Math.floor(limit))
    const state: GateState = { running: 0, waiting: [] }
    const enter = (): Promise<void> => {
        if (state.running < places) {
            state.running += 1
            return Promise.resolve()
        }
        return new Promise((resolve) => {
            state.waiting.push(resolve)
        })
    }
    const leave = (): void => {
        const next = state.waiting.shift()
        if (next === undefined) state.running -= 1
        else next()
    }
    return {
        run: async (work) => {
            await enter()
            try {
                return await work()
            } finally {
                leave()
            }
        },
    }
}
