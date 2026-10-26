import { Test } from "@nestjs/testing"
import { EnvSource } from "@modules/platform/config"
import { redisUrlOf } from "./realtime-address.policy"

const SUBJECT: unique symbol = Symbol("realtime.address.policy")

const buildSubject = async () => {
    const functions = { redisUrlOf }
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useFactory: () => functions }],
    }).compile()
    return moduleRef.get<typeof functions>(SUBJECT)
}

const envOf = (values: Record<string, string>): EnvSource => new EnvSource(values)

describe("redisUrlOf", () => {
    it("reads REALTIME_REDIS_URL as the address when it is declared", async () => {
        const subject = await buildSubject()

        expect(subject.redisUrlOf(envOf({ REALTIME_REDIS_URL: "rediss://user:pw@cache:6380" })).reveal()).toBe(
            "rediss://user:pw@cache:6380",
        )
    })

    it("prefers REALTIME_REDIS_URL over the queue's Redis", async () => {
        const subject = await buildSubject()

        expect(
            subject
                .redisUrlOf(envOf({ REALTIME_REDIS_URL: "redis://own:6379", QUEUE_REDIS_HOST: "nivo-redis" }))
                .reveal(),
        ).toBe("redis://own:6379")
    })

    it("reuses the queue's Redis host, port and password with no secret of its own", async () => {
        const subject = await buildSubject()
        const env = envOf({
            QUEUE_REDIS_HOST: "nivo-redis",
            QUEUE_REDIS_PORT: "6380",
            QUEUE_REDIS_PASSWORD: "p@ss/w:rd+1",
        })

        expect(subject.redisUrlOf(env).reveal()).toBe("redis://:p%40ss%2Fw%3Ard%2B1@nivo-redis:6380")
    })

    it("reuses the queue's Redis without a password and with the default port", async () => {
        const subject = await buildSubject()

        expect(subject.redisUrlOf(envOf({ QUEUE_REDIS_HOST: "nivo-redis" })).reveal()).toBe("redis://nivo-redis:6379")
    })

    it("never serializes the address", async () => {
        const subject = await buildSubject()
        const url = subject.redisUrlOf(envOf({ QUEUE_REDIS_HOST: "nivo-redis", QUEUE_REDIS_PASSWORD: "secret-pw" }))

        expect(JSON.stringify(url)).not.toContain("secret-pw")
    })
})
