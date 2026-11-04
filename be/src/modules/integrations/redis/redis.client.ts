import { Injectable } from "@nestjs/common"
import Redis from "ioredis"
import { InjectRedisOptions } from "./redis.decorators"
import type { RedisAddress, RedisScriptRunner } from "./redis.contracts"
import type { RedisOptions } from "./redis.options"

@Injectable()
/** The one place a Redis connection is opened: a capability asks here for a connection to its address and never imports the client library. */
export class RedisClient {
    constructor(@InjectRedisOptions() private readonly options: RedisOptions) {}

    /** A new connection to the address; it reaches the server on its first command, not when it is made. */
    open(address: RedisAddress): RedisScriptRunner {
        return new Redis({
            host: address.host,
            port: address.port,
            db: address.db,
            password: address.password,
            connectTimeout: this.options.connectTimeoutMs,
            lazyConnect: true,
        })
    }
}
