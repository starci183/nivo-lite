/** One stream entry as ioredis answers it: the stream id and the flat field/value list. */
export type RedisStreamReply = Array<[string, Array<string>]>

/** The slice of an ioredis client the Redis hub uses; the ioredis client satisfies it as it is. */
export interface RedisConnection {
    /** Runs a Lua script atomically (`EVAL script numkeys key... arg...`) and answers what it returns. */
    eval(script: string, keys: number, ...args: Array<string | number>): Promise<unknown>
    /** Reads a stream oldest first (`XRANGE key start end`); `(id` as the start excludes that id. */
    xrange(key: string, start: string, end: string): Promise<RedisStreamReply>
    /** Reads a stream newest first (`XREVRANGE key + - COUNT n`). */
    xrevrange(key: string, ...args: Array<string | number>): Promise<RedisStreamReply>
    /** Publishes a message to a channel. */
    publish(channel: string, message: string): Promise<number>
    /** Subscribes this connection to a channel; ioredis subscribes again after a reconnect. */
    subscribe(channel: string): Promise<unknown>
    /** A message arrived on a channel this connection subscribes to. */
    on(event: "message", listener: (channel: string, message: string) => void): unknown
    /** The connection is ready: emitted after the first connect and after every reconnect. */
    on(event: "ready", listener: () => void): unknown
    /** The connection failed; ioredis reconnects by itself. */
    on(event: "error", listener: (cause: Error) => void): unknown
    /** Closes the connection after its pending commands. */
    quit(): Promise<unknown>
}

/** Opens one Redis connection; the only place the client is constructed. */
export interface RedisFactory {
    /** A new connection to the address the hub is configured with. */
    create(): RedisConnection
}
