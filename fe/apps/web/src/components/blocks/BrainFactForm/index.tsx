"use client"

import { useFactDrawer } from "@/hooks/brain"
import type { BrainTab } from "@/modules/routes"
import { BrainFactFormBase } from "./component"

/** Props for the connected fact form: what the address asks of it. */
interface BrainFactFormProps {
    /** The `fact` of the address: a new fact is being written. */
    readonly fact: string | undefined
    /** The `edit` of the address: the fact in force that gets a new value. */
    readonly edit: string | undefined
    /** The `answer` of the address: the customer question the fact answers. */
    readonly answer: string | undefined
    /** The tab the form sits on and returns to when it closes. */
    readonly tab: BrainTab
}

/** The connected fact form: reads what the address asks for, opens and closes through the address and sends the fact to the back end as a mutation. */
export const BrainFactForm = (props: BrainFactFormProps) => {
    const drawer = useFactDrawer(props)
    if (drawer === null) return null
    return <BrainFactFormBase props={drawer.props} on={drawer.on} />
}
