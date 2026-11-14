"use client"

import { useBrainPolicies } from "@/hooks/brain"
import type { BrainPageHeading } from "@/modules/types"
import { BrainPoliciesBase } from "./component"

/** What the page hands the policies tab: the header without its tabs, and the rule the address opens in the drawer. */
interface BrainPoliciesProps {
    readonly header: BrainPageHeading
    readonly policy: string | undefined
}

/**
 * The connected policies tab: the shop rules in force in the truth graph, grouped by subject. The owner edits a rule in a drawer
 * (a new version of the fact); a manager reads. A failed read stays inside the tab.
 */
export const BrainPolicies = (props: BrainPoliciesProps) => {
    const page = useBrainPolicies({ heading: props.header, policy: props.policy })
    return (
        <BrainPoliciesBase
            props={{ header: page.header, view: page.view, drawer: page.drawer.props }}
            on={{
                ...page.on,
                closeDrawer: page.drawer.on.close,
                submit: page.drawer.on.submit,
                patch: page.drawer.on.patch,
                use: page.drawer.on.use,
                reject: page.drawer.on.reject,
            }}
        />
    )
}
