import { RealtimeError, RealtimeErrorCode } from "./errors/realtime.error"

/** The connection that holds the realtime tables (an entity manager): the first and only one the app composed. */
export const writerOf = <T>(managers: ReadonlyArray<T>): T => {
    const [manager] = managers
    if (manager === undefined) throw new RealtimeError({ code: RealtimeErrorCode.ConnectionMissing })
    return manager
}
