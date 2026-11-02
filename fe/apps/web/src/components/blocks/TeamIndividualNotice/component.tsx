import { Text, Link, Section } from "@starci/grammar/common"

/** Copy the connected notice supplies. */
export interface TeamIndividualNoticeBaseProps {
    readonly props: {
        readonly title: string
        readonly body: string
        readonly ctaLabel: string
        readonly ctaHref: string
    }
}

/** Draws why an individual plan takes no invitations and where the Team plan is. */
export const TeamIndividualNoticeBase = (props: TeamIndividualNoticeBaseProps) => (
    <Section title={props.props.title} description={props.props.body}>
        <Text>
            <Link href={props.props.ctaHref}>{props.props.ctaLabel}</Link>
        </Text>
    </Section>
)
