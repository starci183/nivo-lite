import type { PollLimits } from "./connection-poll.contracts"

/** Whether a call may be made now, and if not how long to wait. */
export interface TokenAnswer {
    /** True when the call may be made. */
    readonly allowed: boolean
    /** How long until a call may be made; 0 when allowed. */
    readonly waitMs: number
}

/** Where the rate-limit state lives: Redis when the app declares it (every replica shares it), else this process. */
export interface PollLimiterStore {
    /** Takes one call from the bucket of `key`. */
    take(key: string, limits: PollLimits, now: number): Promise<TokenAnswer>
    /** Takes one of the `cap` slots of `key` for `member` until `leaseMs` pass; false when all are taken. */
    enter(key: string, member: string, cap: number, leaseMs: number, now: number): Promise<boolean>
    /** Gives the slot of `member` back. */
    leave(key: string, member: string): Promise<void>
}

/** The slice of an ioredis client the Redis store uses. */
export interface PollRedis {
    /** Runs a Lua script atomically (`EVAL script numkeys key... arg...`) and answers what it returns. */
    eval(script: string, keys: number, ...args: Array<string | number>): Promise<unknown>
}
