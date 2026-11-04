import { Test } from "@nestjs/testing"
import { REDIS_OPTIONS } from "./redis.decorators"
import { RedisClient } from "./redis.client"

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [RedisClient, { provide: REDIS_OPTIONS, useValue: { connectTimeoutMs: 1000 } }],
    }).compile()
    return moduleRef.get(RedisClient)
}

describe("RedisClient", () => {
    it("opens a connection that runs scripts and has not reached the server yet", async () => {
        const client = await build()

        const connection = client.open({ host: "localhost", port: 6379, db: 0, password: undefined })

        expect(typeof connection.eval).toBe("function")
        expect(Reflect.get(connection, "status")).toBe("wait")
    })
})
