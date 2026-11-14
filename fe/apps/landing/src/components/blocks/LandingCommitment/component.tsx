import { Heading, Avatar, Badge, Cluster, DescriptionList, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import { ANCHOR } from "./classNames"

/** One principle: a title over its explanation. */
interface LandingCommitmentPrinciple {
    readonly id: string
    readonly title: string
    readonly text: string
}

/** The resolved words the commitment section draws. */
interface LandingCommitmentBaseProps {
    readonly props: {
        readonly regionLabel: string
        readonly eyebrow: string
        readonly titleLines: ReadonlyArray<string>
        readonly panelLabel: string
        readonly panelText: string
        readonly author: string
        readonly authorRole: string
        readonly authorMarkSrc: string
        readonly quote: string
        readonly aiChip: string
        readonly aiNote: string
        readonly principles: ReadonlyArray<LandingCommitmentPrinciple>
    }
}

/**
 * Principles block, one joined card in three bands: who speaks, the quote, the principles. Attribution is the
 * NIVO team, never a personal quote or a photo of a person.
 */
export const LandingCommitmentBase = (props: LandingCommitmentBaseProps) => (
    <div id="commitment" className={ANCHOR}>
        <SurfaceCard
            label={props.props.titleLines.join(" ")}
            ariaLabel={props.props.regionLabel}
            fact={props.props.eyebrow}
            headingLevel={2}
            headers={[
                {
                    kind: "custom",
                    children: (
                        <Stack gap="row">
                            <Stack gap="inline">
                                <Text size="xs">{props.props.panelLabel}</Text>
                                <Text isStrong>{props.props.panelText}</Text>
                            </Stack>
                            <Cluster gap="inline">
                                <Avatar
                                    name={props.props.author}
                                    src={props.props.authorMarkSrc}
                                    size="md"
                                    isDecorative
                                />
                                <Stack gap="identity">
                                    <Text isStrong>{props.props.author}</Text>
                                    <Text size="sm" tone="muted">
                                        {props.props.authorRole}
                                    </Text>
                                </Stack>
                            </Cluster>
                        </Stack>
                    ),
                },
                {
                    kind: "custom",
                    children: (
                        <Stack gap="row">
                            <Heading level={3}>{props.props.quote}</Heading>
                            <Cluster gap="inline">
                                <Badge tone="neutral">{props.props.aiChip}</Badge>
                                <Text size="sm" tone="muted">
                                    {props.props.aiNote}
                                </Text>
                            </Cluster>
                        </Stack>
                    ),
                },
            ]}
        >
            <DescriptionList
                layout="columns"
                items={props.props.principles.map((principle) => ({
                    id: principle.id,
                    term: principle.title,
                    description: principle.text,
                }))}
            />
        </SurfaceCard>
    </div>
)
