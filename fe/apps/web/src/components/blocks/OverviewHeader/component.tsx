import { Button } from "@starci/grammar/common"
import { ACTIONS_CLASS_NAME } from "./classNames"

/** The words and links of the overview heading. */
export interface OverviewHeaderView {
    readonly title: string
    readonly description: string
    readonly openOfficeLabel: string
    readonly openOfficeHref: string
    readonly newLeadLabel: string
    readonly newLeadHref: string
    readonly newLeadIsPrimary: boolean
}

/** The slot of the page head this block fills. */
export type OverviewHeaderPart = "title" | "description" | "actions"

/** What the heading draws while the dashboard is read: the same shape, as inert geometry. */
export const OVERVIEW_HEADER_PLACEHOLDER: OverviewHeaderView = {
    title: "-",
    description: "-",
    openOfficeLabel: "-",
    openOfficeHref: "",
    newLeadLabel: "-",
    newLeadHref: "",
    newLeadIsPrimary: false,
}

/** One slot of the heading and whether its words are still placeholders. */
interface OverviewHeaderBaseProps {
    readonly props: OverviewHeaderView & { readonly part: OverviewHeaderPart; readonly isSkeleton: boolean }
}

/** One slot of the overview page head: the greeting, the time of the reading, or the two actions (open the Office, and add a lead, the primary one when nothing waits for the owner). */
export const OverviewHeaderBase = (props: OverviewHeaderBaseProps) => {
    const p = props.props
    if (p.part === "title") return <>{p.title}</>
    if (p.part === "description") return <>{p.description}</>
    return (
        <div className={ACTIONS_CLASS_NAME}>
            <Button intent="neutral" href={p.openOfficeHref} isSkeleton={p.isSkeleton}>
                {p.openOfficeLabel}
            </Button>
            <Button intent={p.newLeadIsPrimary ? "commit" : "neutral"} href={p.newLeadHref} isSkeleton={p.isSkeleton}>
                {p.newLeadLabel}
            </Button>
        </div>
    )
}
