import type { ReactNode } from "react"
import type { HiringViews } from "@/modules/types"

import { Text } from "@starci/grammar/common"
import { EVENTS_CLASS_NAME } from "./classNames"

interface HiringCandidateHistoryProps {
    readonly items: ReadonlyArray<HiringViews["candidateLine"]>
    readonly loadingLabel: string
    readonly isLoading: boolean
}

/** The actual detail read's timeline rows; status notices and retry remain in the module Base. */
export const HiringCandidateHistory = (props: HiringCandidateHistoryProps): ReactNode =>
    props.items.length === 0 ? (
        <Text tone="muted" isLoading={props.isLoading}>
            {props.loadingLabel}
        </Text>
    ) : (
        props.items.map((event) => (
            <div key={event.id} className={EVENTS_CLASS_NAME}>
                <Text size="sm" isLoading={props.isLoading}>
                    {event.title}
                </Text>
                <Text size="xs" tone="muted" isLoading={props.isLoading}>
                    {event.text}
                </Text>
            </div>
        ))
    )
