import { Button, SectionHeader } from "@starci/grammar/common"
import { ACTIONS_CLASS_NAME } from "./classNames"

/** The words and links of the overview heading. */
interface OverviewHeaderBaseProps {
    readonly props: {
        readonly eyebrow: string
        readonly title: string
        readonly description: string
        readonly openOfficeLabel: string
        readonly openOfficeHref: string
        readonly newLeadLabel: string
        readonly newLeadHref: string
        readonly newLeadIsPrimary: boolean
    }
}

/** The overview heading with its two actions: open the Office, and add a lead (the primary one when nothing waits for the owner). */
export const OverviewHeaderBase = (props: OverviewHeaderBaseProps) => (
    <SectionHeader
        level={1}
        eyebrow={props.props.eyebrow}
        title={props.props.title}
        description={props.props.description}
        action={
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
