import type { PollLimits } from "./connection-poll.contracts"
import type { PollLimiterStore, PollRedis, TokenAnswer } from "./poll-limiter.contracts"

/** Idle buckets are forgotten after this long: a bucket that was idle is full again anyway. */
const BUCKET_TTL_MS = 3_600_000

/** KEYS[1] bucket; ARGV rate per second, burst, now ms, ttl ms. Answers {allowed, waitMs}. */
const TAKE_SCRIPT = [
    "local data = redis.call('HMGET', KEYS[1], 'tokens', 'at')",
    "local rate = tonumber(ARGV[1])",
    "local burst = tonumber(ARGV[2])",
    "local now = tonumber(ARGV[3])",
    "local tokens = tonumber(data[1])",
    "local at = tonumber(data[2])",
    "if tokens == nil then tokens = burst; at = now end",
    "tokens = math.min(burst, tokens + math.max(0, now - at) * rate / 1000)",
    "local allowed = 0",
    "local wait = 0",
    "if tokens >= 1 then tokens = tokens - 1; allowed = 1 else wait = math.ceil((1 - tokens) * 1000 / rate) end",
    "redis.call('HSET', KEYS[1], 'tokens', tostring(tokens), 'at', tostring(now))",
    "redis.call('PEXPIRE', KEYS[1], tonumber(ARGV[4]))",
    "return {allowed, wait}",
].join("\n")

/** KEYS[1] slots (a sorted set of members by lease end); ARGV now ms, cap, lease ms, member. Answers 1 when the member got a slot. */
const ENTER_SCRIPT = [
    "redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])",
    "if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[2]) then return 0 end",
    "redis.call('ZADD', KEYS[1], tonumber(ARGV[1]) + tonumber(ARGV[3]), ARGV[4])",
    "redis.call('PEXPIRE', KEYS[1], tonumber(ARGV[3]))",
    "return 1",
].join("\n")

/** KEYS[1] slots; ARGV member. */
const LEAVE_SCRIPT = "return redis.call('ZREM', KEYS[1], ARGV[1])"

/** The allowed flag and the wait of a script answer, or undefined when the answer is not a pair of numbers. */
const pairOf = (answer: unknown): readonly [number, number] | undefined => {
    if (!Array.isArray(answer)) return undefined
    const [allowed, waitMs] = answer.map(Number)
    return allowed === undefined || waitMs === undefined ? undefined : [allowed, waitMs]
}

/** The limiter state in Redis, changed by Lua scripts so every replica of the app spends from the same bucket and the same slots. */
export class RedisPollLimiterStore implements PollLimiterStore {
    constructor(
        private readonly redis: PollRedis,
        private readonly prefix: string,
    ) {}

    /** Takes one call from the bucket of `key`. A reply that cannot be read denies the call for a second rather than letting a burst through. */
    async take(key: string, limits: PollLimits, now: number): Promise<TokenAnswer> {
        const reply = await this.redis.eval(
            TAKE_SCRIPT,
            1,
            `${this.prefix}:poll:bucket:${key}`,
            limits.ratePerSecond,
            limits.burst,
            now,
            BUCKET_TTL_MS,
        )
        const pair = pairOf(reply)
        return pair === undefined ? { allowed: false, waitMs: 1000 } : { allowed: pair[0] === 1, waitMs: pair[1] }
    }

    /** Takes a slot of `key` for `member`. */
    async enter(key: string, member: string, cap: number, leaseMs: number, now: number): Promise<boolean> {
        const reply = await this.redis.eval(ENTER_SCRIPT, 1, `${this.prefix}:poll:slots:${key}`, now, cap, leaseMs, member)
        return Number(reply) === 1
    }

    /** Gives the slot of `member` back. */
    async leave(key: string, member: string): Promise<void> {
        await this.redis.eval(LEAVE_SCRIPT, 1, `${this.prefix}:poll:slots:${key}`, member)
    }
}
