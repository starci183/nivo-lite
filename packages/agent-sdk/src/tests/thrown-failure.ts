import { sdkFailureOf } from "../invoke/sdk-failure"

/** The code and subject of the SDK error a call throws, or null when it throws nothing or something that is no coded error. */
export const thrownFailureOf = (call: () => unknown): ReturnType<typeof sdkFailureOf> | null => {
    try {
        call()
    } catch (error) {
        return sdkFailureOf(error) ?? null
    }
    return null
}
