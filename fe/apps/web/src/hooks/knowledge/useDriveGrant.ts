"use client"

import { useCallback, useState, useTransition } from "react"
import { useSettledGraphQL } from "@/hooks/connection-wizard"
import { useMutateAuthorizeDriveSwr, useMutateDisconnectDriveSwr, useQueryDriveGrantSwr } from "@/hooks/swr"

/** Where the Google Drive read grant of the workspace stands; `hidden` while it loads or for a member who may not see it. */
export type DriveGrantState = "hidden" | "none" | "connected" | "lost"

/** The Google Drive read grant of the workspace and the two things an owner or manager does with it. */
export interface DriveGrantControl {
    readonly state: DriveGrantState
    /** The Google account that gave the grant, blank when none. */
    readonly email: string
    readonly isPending: boolean
    /** The back end failure of the last action, or null. */
    readonly error: string | null
    /** Sends the browser to the Google consent; it comes back to `returnTo` with `?drive=ok|error`. */
    readonly grant: (returnTo: string) => void
    /** Forgets the grant. */
    readonly disconnect: () => void
}

const stateOf = (value: string | undefined): DriveGrantState => {
    if (value === "connected" || value === "lost" || value === "none") return value
    return "hidden"
}

/** Reads the Google Drive read grant of the active workspace and starts or forgets it. */
export const useDriveGrant = (): DriveGrantControl => {
    const settle = useSettledGraphQL()
    const grantQuery = useQueryDriveGrantSwr()
    const authorize = useMutateAuthorizeDriveSwr()
    const forget = useMutateDisconnectDriveSwr()
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const grant = useCallback(
        (returnTo: string) =>
            startTransition(async () => {
                setError(null)
                const started = await settle(() => authorize.trigger({ returnTo }))
                if (started.kind !== "ok") return setError(started.message)
                window.location.assign(started.value.url)
            }),
        [authorize, settle],
    )
    const disconnect = useCallback(
        () =>
            startTransition(async () => {
                setError(null)
                const done = await settle(() => forget.trigger())
                if (done.kind !== "ok") return setError(done.message)
                await grantQuery.mutate()
            }),
        [forget, grantQuery, settle],
    )
    return {
        state: grantQuery.error === undefined ? stateOf(grantQuery.data?.state) : "hidden",
        email: grantQuery.data?.email ?? "",
        isPending,
        error,
        grant,
        disconnect,
    }
}
