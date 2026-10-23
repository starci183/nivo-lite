"use client"

import { useCreditsData, useCreditsOrder, useCreditsView } from "@/hooks/credits"
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
    return (
        <CreditsOverviewBase
            props={{
                ...copy,
                slot: { isLoading: !data && !error, isError: Boolean(error), items: data ? copy.view : undefined },
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
            props={{ ...copy, slot: { isLoading: true } }}
            on={{ buy: () => undefined, retry: () => undefined }}
        />
    )
}
