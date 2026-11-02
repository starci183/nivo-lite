"use client"

import { useCreditsData, useCreditsOrder, useCreditsView } from "@/hooks/credits"
import { loadingSlot } from "@/hooks/slot"
import type { CreditsOverviewView, DataSlot } from "@/modules/types"
import { CreditsOverviewBase } from "./component"

interface CreditsOverviewProps {
    readonly contactHref: string
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

/** Resolves route-loading copy without issuing any data operations. */
export const CreditsOverviewSkeleton = () => {
    const copy = useCreditsView(null, null)
    return (
        <CreditsOverviewBase
            props={{ ...copy, slot: loadingSlot() }}
            on={{ buy: () => undefined, retry: () => undefined }}
        />
    )
}
