import { DescriptionList, IconButton, Section, SurfaceCard, Text, Tooltip } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { OverviewSavingsView } from "@/modules/types"

/** What the savings card is told. */
interface OverviewSavingsCardProps {
    readonly props: {
        readonly title: string
        /** What the hours are: the period, said as the line under the figure. */
        readonly hoursNote: string
        /** Names the help control that shows how the hours are counted. */
        readonly helpLabel: string
        readonly savings: OverviewSavingsView
        readonly isLoading: boolean
    }
}

/** What the agents did for the owner: the hours saved with the way they are counted one hover away, and the other things done. */
export const OverviewSavingsCard = (props: OverviewSavingsCardProps) => {
    const copy = props.props
    const rows = [{ id: "hours", term: copy.hoursNote, value: copy.savings.hours }, ...copy.savings.facts]
    return (
        <Section
            title={copy.title}
            headingLevel={2}
            isLoading={copy.isLoading}
            action={
                <Tooltip
                    content={copy.savings.definition}
                    trigger={
                        <IconButton
                            label={copy.helpLabel}
                            source={nivoIconSource("info", "leading")}
                            intent="neutral"
                            size="sm"
                        />
                    }
                />
            }
        >
            <SurfaceCard ariaLabel={copy.title} height="fill" isLoading={copy.isLoading}>
                <DescriptionList
                    layout="columns"
                    isDivided
                    isLoading={copy.isLoading}
                    items={rows.map((fact) => ({
                        id: fact.id,
                        term: fact.term,
                        description: (
                            <Text isStrong isLoading={copy.isLoading}>
                                {fact.value}
                            </Text>
                        ),
                    }))}
                />
            </SurfaceCard>
        </Section>
    )
}
