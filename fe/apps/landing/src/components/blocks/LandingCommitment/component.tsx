import { Fragment } from "react"
import {
    Avatar,
    Badge,
    Divider,
    PageContainer,
    Region,
    SectionHeader,
    SurfaceCard,
    SurfaceCopyGroup,
    Text,
} from "@starci/grammar/common"
import {
    AI_NOTE,
    ANCHOR,
    AUTHOR,
    AUTHOR_TEXT,
    BAND_FIRST,
    BAND_LAST,
    BAND_MID,
    PRINCIPLES,
    QUOTE,
    SECTION_STACK,
} from "./classNames"

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
            <div className={SECTION_STACK}>
                <SectionHeader
                    eyebrow={props.props.eyebrow}
                    title={props.props.titleLines.map((line, position) => (
                        <Fragment key={line}>
                            {position > 0 ? <br /> : null}
                            {line}
                        </Fragment>
                    ))}
                />
                <SurfaceCard composition="joined">
                    <div className={BAND_FIRST}>
                        <SurfaceCopyGroup>
                            <Text size="xs">{props.props.panelLabel}</Text>
                            <Text weight="medium">{props.props.panelText}</Text>
                        </SurfaceCopyGroup>
                        <div className={AUTHOR}>
                            <Avatar name={props.props.author} src={props.props.authorMarkSrc} size="md" isDecorative />
                            <div className={AUTHOR_TEXT}>
                                <Text weight="medium">{props.props.author}</Text>
                                <Text size="sm" tone="muted">
                                    {props.props.authorRole}
                                </Text>
                            </div>
                        </div>
                    </div>
                    <Divider semantics="presentation" />
                    <div className={BAND_MID}>
                        <div className={QUOTE}>
                            <Text size="md" weight="medium">
                                {props.props.quote}
                            </Text>
                        </div>
                        <div className={AI_NOTE}>
                            <Badge tone="neutral">{props.props.aiChip}</Badge>
                            <Text size="sm" tone="muted">
                                {props.props.aiNote}
                            </Text>
                        </div>
                    </div>
                    <Divider semantics="presentation" />
                    <div className={BAND_LAST}>
                        <div className={PRINCIPLES}>
                            {props.props.principles.map((principle) => (
                                <SurfaceCopyGroup key={principle.id}>
                                    <Text weight="medium">{principle.title}</Text>
                                    <Text size="sm" tone="muted">
                                        {principle.text}
                                    </Text>
                                </SurfaceCopyGroup>
                            ))}
                        </div>
                    </div>
                </SurfaceCard>
            </div>
        </PageContainer>
    </Region>
)
