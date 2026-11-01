import { Fragment } from "react"
import {
    Avatar,
    Badge,
    Cluster,
    Divider,
    Grid,
    PageContainer,
    Region,
    SectionHeader,
    Stack,
    SurfaceCard,
    SurfaceCopyGroup,
    Text,
} from "@starci/grammar/common"
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
    <Region id="commitment" label={props.props.regionLabel} className={ANCHOR}>
        <PageContainer measure="product">
            <Stack gap="section">
                <SectionHeader
                    eyebrow={props.props.eyebrow}
                    title={props.props.titleLines.map((line, position) => (
                        <Fragment key={line}>
                            {position > 0 ? <br /> : null}
                            {line}
                        </Fragment>
                    ))}
                />
                <SurfaceCard>
                    <Stack gap="row">
                        <Stack gap="row">
                            <SurfaceCopyGroup>
                                <Text size="xs">{props.props.panelLabel}</Text>
                                <Text weight="medium">{props.props.panelText}</Text>
                            </SurfaceCopyGroup>
                            <Cluster gap="row">
                                <Avatar
                                    name={props.props.author}
                                    src={props.props.authorMarkSrc}
                                    size="md"
                                    isDecorative
                                />
                                <Stack gap="identity">
                                    <Text weight="medium">{props.props.author}</Text>
                                    <Text size="sm" tone="muted">
                                        {props.props.authorRole}
                                    </Text>
                                </Stack>
                            </Cluster>
                        </Stack>
                        <Divider semantics="presentation" />
                        <Stack gap="row">
                            <Text size="md" weight="medium">
                                {props.props.quote}
                            </Text>
                            <Cluster gap="inline">
                                <Badge tone="neutral">{props.props.aiChip}</Badge>
                                <Text size="sm" tone="muted">
                                    {props.props.aiNote}
                                </Text>
                            </Cluster>
                        </Stack>
                        <Divider semantics="presentation" />
                        <Grid kind="cards" columns={2}>
                            {props.props.principles.map((principle) => (
                                <SurfaceCopyGroup key={principle.id}>
                                    <Text weight="medium">{principle.title}</Text>
                                    <Text size="sm" tone="muted">
                                        {principle.text}
                                    </Text>
                                </SurfaceCopyGroup>
                            ))}
                        </Grid>
                    </Stack>
                </SurfaceCard>
            </Stack>
        </PageContainer>
    </Region>
)
