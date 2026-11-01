import { useEffect, useMemo, useRef, useState } from "react"
import type { Middleware, SWRConfiguration } from "swr"

/** The interval a read answers for its data: SWR's `refreshInterval` as a function, `0` meaning stop. */
type IntervalOf = (data: unknown) => number

/** What a read gave as `refreshInterval`, kept apart from numbers and the absent case. */
type IntervalSource = SWRConfiguration["refreshInterval"]

/**
 * Whether polling has to be started again. SWR schedules the next tick only while the interval function answers above zero;
 * once it answered `0` nothing wakes it, so a later answer above zero for newer data needs a fresh start.
 */
const shouldRestartPolling = (chainStopped: boolean, nextIntervalMs: number): boolean =>
    chainStopped && nextIntervalMs > 0

/** The function a read gave, or `undefined` when its interval is a number or absent. */
const intervalFunctionOf = (source: IntervalSource): IntervalOf | undefined =>
    typeof source === "function" ? source : undefined

/**
 * SWR middleware that keeps a function `refreshInterval` alive. The read still decides every tick and may answer `0` to stop;
 * when newer data makes it answer above `0` after it stopped, polling starts again. Reads with a numeric or absent interval
 * pass through untouched.
 */
export const pollingRestart: Middleware = (useSWRNext) => (key, fetcher, config) => {
    const source = config.refreshInterval
    const latest = useRef(intervalFunctionOf(source))
    const chainStopped = useRef(false)
    const answeredGeneration = useRef(0)
    const [generation, setGeneration] = useState(0)
    const isFunction = typeof source === "function"
    useEffect(() => {
        latest.current = intervalFunctionOf(source)
    }, [source])
    const wrapper = useMemo<IntervalOf | undefined>(() => {
        if (!isFunction) return undefined
        // Each generation is a new identity, which is what makes SWR's polling effect run again.
        return (data) => {
            const answer = latest.current?.(data) ?? 0
            answeredGeneration.current = generation
            chainStopped.current = answer === 0
            return answer
        }
    }, [isFunction, generation])
    const response = useSWRNext(key, fetcher, wrapper === undefined ? config : { ...config, refreshInterval: wrapper })
    const data: unknown = response.data
    useEffect(() => {
        const answer = latest.current?.(data) ?? 0
        if (!shouldRestartPolling(chainStopped.current, answer)) return
        chainStopped.current = false
        setGeneration((previous) => previous + 1)
    }, [data])
    return response
}
