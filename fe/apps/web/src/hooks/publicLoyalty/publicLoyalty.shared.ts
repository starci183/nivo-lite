import type { useMutateVerifyLoyaltyCodeSwr } from "@/hooks/swr"

/** The points the back end shows once the code is right. */
export type PublicLoyaltyPoints = NonNullable<
    Awaited<ReturnType<ReturnType<typeof useMutateVerifyLoyaltyCodeSwr>["trigger"]>>
>["points"]

/** Where the visitor is: typing the phone, typing the code that was sent, or reading the points. */
export type PublicLoyaltyStep = "phone" | "code" | "result"

/** Why a step did not go through: a refusal code of the back end, or the call itself failing. */
export type PublicLoyaltyFailure = "bad_phone" | "closed" | "busy" | "wrong" | "unavailable"

/** The failure a back end code stands for; `none` is success and has none. */
export const refusalOf = (code: string): PublicLoyaltyFailure | null => {
    if (code === "bad_phone" || code === "closed" || code === "busy" || code === "wrong") return code
    return code === "none" ? null : "unavailable"
}

const ERROR_KEYS: Readonly<Record<PublicLoyaltyFailure, string>> = {
    bad_phone: "errBadPhone",
    closed: "errClosed",
    busy: "errBusy",
    wrong: "errWrong",
    unavailable: "unavailable",
}

/** The `loyaltyPublic` catalog key of the message under a failure. */
export const errorKeyOf = (failure: PublicLoyaltyFailure): string => ERROR_KEYS[failure]
