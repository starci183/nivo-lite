"use client"

import { useCreditsData, useCreditsOrder, useCreditsView } from "@/hooks/credits"
import { loadingSlot } from "@/hooks/slot"
import type { CreditsOverviewView, DataSlot } from "@/modules/types"
import { CreditsOverviewBase, type CreditsOverviewShape } from "./component"

interface CreditsOverviewProps {
    readonly contactHref: string
    /** The balance (main column) or the offers (rail). */
    readonly shape: CreditsOverviewShape
}

/** Connects the credits overview and hands all render states to its pure sibling. */
export const CreditsOverview = (props: CreditsOverviewProps) => {
    const credits = useCreditsData(props.contactHref)
    const { data, refresh } = credits
    const error: unknown = credits.error
    const checkout = useCreditsOrder(data?.workspaceId)
    const copy = useCreditsView(data, checkout.busy)
    let slot: DataSlot<CreditsOverviewView> = { items: copy.view }
    if (data === null) slot = error ? { isError: true } : loadingSlot()
    return (
        <CreditsOverviewBase
            shape={props.shape}
            props={{
                ...copy,
                slot,
            }}
            on={{
                buy: (target) => {
                    void checkout.begin(target)
                },
                retry: () => void refresh(),
            }}
        />
    )
}

/** Which part the skeleton holds the place of. */
interface CreditsOverviewSkeletonProps {
    readonly shape: CreditsOverviewShape
}

/** Resolves route-loading copy without issuing any data operations. */
export const CreditsOverviewSkeleton = (props: CreditsOverviewSkeletonProps) => {
    const copy = useCreditsView(null, null)
    return (
        <CreditsOverviewBase
            shape={props.shape}
            props={{ ...copy, slot: loadingSlot() }}
            on={{ buy: () => undefined, retry: () => undefined }}
        />
    )
}
