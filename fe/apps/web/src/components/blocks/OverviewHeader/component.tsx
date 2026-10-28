import { Button, PageHeader } from "@starci/grammar/common"
import { ACTIONS_CLASS_NAME } from "./classNames"

/** The words and links of the overview heading. */
export interface OverviewHeaderView {
    readonly eyebrow: string
    readonly title: string
    readonly description: string
    readonly openOfficeLabel: string
    readonly openOfficeHref: string
    readonly newLeadLabel: string
    readonly newLeadHref: string
    readonly newLeadIsPrimary: boolean
}

/** What the heading draws while the dashboard is read: the same shape, as inert geometry. */
export const OVERVIEW_HEADER_PLACEHOLDER: OverviewHeaderView = {
    eyebrow: "-",
    title: "-",
    description: "-",
    openOfficeLabel: "-",
    openOfficeHref: "",
    newLeadLabel: "-",
    newLeadHref: "",
    newLeadIsPrimary: false,
}

/** The heading and whether its words are still placeholders. */
interface OverviewHeaderBaseProps {
    readonly props: OverviewHeaderView & { readonly isSkeleton: boolean }
}

/** The overview page head with its two actions: open the Office, and add a lead (the primary one when nothing waits for the owner). */
export const OverviewHeaderBase = (props: OverviewHeaderBaseProps) => (
    <PageHeader
        measure="product"
        title={props.props.title}
        meta={props.props.eyebrow}
        description={props.props.description}
        isSkeleton={props.props.isSkeleton}
        actions={
            <div className={ACTIONS_CLASS_NAME}>
                <Button intent="neutral" href={props.props.openOfficeHref}>
                    {props.props.openOfficeLabel}
                </Button>
                <Button intent={props.props.newLeadIsPrimary ? "commit" : "neutral"} href={props.props.newLeadHref}>
                    {props.props.newLeadLabel}
                </Button>
            </div>
        }
    />
)
