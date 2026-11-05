"use client"

import { useBrainAsk } from "@/hooks/brain"
import type { BrainPageHeading } from "@/modules/types"
import { BrainAskBase } from "./component"

/** What the page tells the try-it screen. */
interface BrainAskProps {
    /** The Second Brain heading: trail, title and line. */
    readonly heading: BrainPageHeading
}

/**
 * The connected try-it screen of the Second Brain: ask a question as a customer (or as the team) through the view of one installed
 * agent, see the passages it would read and how well each matches, and compare what the customer and that agent are allowed to see.
 */
export const BrainAsk = (props: BrainAskProps) => {
    const view = useBrainAsk({ heading: props.heading })
    return <BrainAskBase {...view} />
}
