import { Test } from "@nestjs/testing"
import { EnvSource } from "@modules/platform/config"
import { parseRealtimeConfig } from "./realtime.config"
import { REDIS_DEFAULT_PREFIX } from "./realtime.contracts"
import type { RedisRealtimeOptions } from "./realtime.options"

const SUBJECT: unique symbol = Symbol("realtime.config")

const buildSubject = async () => {
    const functions = { parseRealtimeConfig }
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useFactory: () => functions }],
    }).compile()
    return moduleRef.get<typeof functions>(SUBJECT)
}

const envOf = (values: Record<string, string>): EnvSource => new EnvSource(values)
const redisOf = async (values: Record<string, string>): Promise<RedisRealtimeOptions> => {
    const { parseRealtimeConfig } = await buildSubject()
    const config = parseRealtimeConfig(envOf(values))
    if (config.hub !== "redis") throw new Error(`expected the redis hub, got ${config.hub}`)
    return config
}

describe("parseRealtimeConfig", () => {
    it("defaults to postgres when no Redis is declared", async () => {
        const { parseRealtimeConfig } = await buildSubject()
        expect(parseRealtimeConfig(envOf({}))).toEqual({ hub: "postgres", listenUrl: undefined })
    })

    it("uses the dedicated LISTEN URL of the postgres hub", async () => {
        const { parseRealtimeConfig } = await buildSubject()
        const config = parseRealtimeConfig(envOf({ REALTIME_HUB: "postgres", REALTIME_DB_URL: "postgres://listen" }))
        expect(config.hub === "postgres" && config.listenUrl?.reveal()).toBe("postgres://listen")
    })

    it("selects the memory hub only when it is declared", async () => {
        const { parseRealtimeConfig } = await buildSubject()
        expect(parseRealtimeConfig(envOf({ REALTIME_HUB: "memory", QUEUE_REDIS_HOST: "nivo-redis" }))).toEqual({ hub: "memory" })
    })

    it("defaults to redis and reads REALTIME_REDIS_URL as the address when it is declared", async () => {
        const { parseRealtimeConfig } = await buildSubject()
        const config = await redisOf({ REALTIME_REDIS_URL: "rediss://user:pw@cache:6380", REALTIME_REDIS_DB: "2", REALTIME_REDIS_PREFIX: "rt" })
        expect({ url: config.url.reveal(), db: config.db, prefix: config.prefix }).toEqual({
            url: "rediss://user:pw@cache:6380",
            db: 2,
            prefix: "rt",
        })
    })

    it("prefers REALTIME_REDIS_URL over the queue's Redis", async () => {
        const { parseRealtimeConfig } = await buildSubject()
        const config = await redisOf({ REALTIME_REDIS_URL: "redis://own:6379", QUEUE_REDIS_HOST: "nivo-redis" })
        expect(config.url.reveal()).toBe("redis://own:6379")
    })

    it("reuses the queue's Redis host, port and password with no secret of its own", async () => {
        const { parseRealtimeConfig } = await buildSubject()
        const config = await redisOf({ QUEUE_REDIS_HOST: "nivo-redis", QUEUE_REDIS_PORT: "6380", QUEUE_REDIS_PASSWORD: "p@ss/w:rd+1" })
        expect(config.url.reveal()).toBe("redis://:p%40ss%2Fw%3Ard%2B1@nivo-redis:6380")
    })

    it("reuses the queue's Redis without a password and with the default port and prefix", async () => {
        const { parseRealtimeConfig } = await buildSubject()
        const config = await redisOf({ QUEUE_REDIS_HOST: "nivo-redis" })
        expect({ url: config.url.reveal(), db: config.db, prefix: config.prefix }).toEqual({
            url: "redis://nivo-redis:6379",
            db: 0,
            prefix: REDIS_DEFAULT_PREFIX,
        })
    })

    it("never serializes the address", async () => {
        const { parseRealtimeConfig } = await buildSubject()
        expect(JSON.stringify(await redisOf({ QUEUE_REDIS_HOST: "nivo-redis", QUEUE_REDIS_PASSWORD: "secret-pw" }))).not.toContain("secret-pw")
    })
})
