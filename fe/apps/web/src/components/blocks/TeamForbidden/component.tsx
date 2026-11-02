import { Link, Section } from "@starci/grammar/common"

/** Copy the connected notice supplies. */
export interface TeamForbiddenBaseProps {
    readonly props: {
        readonly eyebrow: string
        readonly title: string
        readonly body: string
        readonly backLabel: string
        readonly backHref: string
    }
}

/** Draws the friendly 403 a staff member sees instead of the team. */
export const TeamForbiddenBase = (props: TeamForbiddenBaseProps) => (
    <Section
        title={props.props.title}
        description={props.props.eyebrow === "" ? props.props.body : `${props.props.eyebrow} — ${props.props.body}`}
    >
        <Link href={props.props.backHref}>{props.props.backLabel}</Link>
    </Section>
)
