import { SectionHeader, Text, TextAction } from "@starci/grammar/common"

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
    <>
        <SectionHeader
            level={2}
            eyebrow={props.props.eyebrow}
            title={props.props.title}
            description={props.props.body}
        />
        <Text>
            <TextAction href={props.props.backHref}>{props.props.backLabel}</TextAction>
        </Text>
    </>
)
