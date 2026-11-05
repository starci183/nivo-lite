"use client"

import { usePublicBrain, usePublicComposeDrawers } from "@/hooks/brain"
import type { BrainPageHeading } from "@/modules/types"
import { PublicBrainBase } from "./component"

/** What the page tells the public documents screen. */
interface PublicBrainProps {
    /** The Second Brain heading: trail, title and line. */
    readonly heading: BrainPageHeading
    /** The public document the address opens. */
    readonly doc: string | undefined
    /** The form the address asks for: NIVO drafts from internal documents, or the owner writes by hand. */
    readonly compose: "pick" | "write" | undefined
    /** The customer question the written form starts with; empty when none. */
    readonly composeTitle: string
}

/**
 * The connected public documents of the Second Brain: what customers may read or will once approved, the open one as a draft the owner
 * edits and approves, and the customer questions nobody answered yet. Only owners and managers write; the forms that start a document
 * are drawers over the list.
 */
export const PublicBrain = (props: PublicBrainProps) => {
    const view = usePublicBrain({ heading: props.heading, docId: props.doc })
    const drawers = usePublicComposeDrawers({ compose: props.compose, title: props.composeTitle })
    return <PublicBrainBase props={{ ...view.props, ...drawers }} on={view.on} />
}
