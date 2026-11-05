/** Where one Redis connection goes. */
export interface RedisAddress {
    /** The host. */
    readonly host: string
    /** The port. */
    readonly port: number
    /** The database number. */
    readonly db: number
    /** The password, when the server needs one. */
    readonly password: string | undefined
}

/** One argument of a script: a key or a value. */
export type RedisArgument = string | number

/** The slice of a Redis connection a capability runs scripts on. */
export interface RedisScriptRunner {
    /** Runs a Lua script atomically (`EVAL script numkeys key... arg...`) and answers what it returns. */
    eval(script: string, keys: number, ...args: Array<RedisArgument>): Promise<unknown>
}
