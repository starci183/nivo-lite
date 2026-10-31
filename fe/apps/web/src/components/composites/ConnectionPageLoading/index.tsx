import {
    DescriptionList,
    LeadingNumber,
    Page,
    Pane,
    PaneGrid,
    PaneSection,
    SectionHeader,
    Skeleton,
} from "@starci/grammar/common"
import type { BreadcrumbItem } from "@starci/grammar/common"

/** The words of a connection page while it loads: the trail, the step titles and the rail heading are real. */
export interface ConnectionPageLoadingProps {
    readonly props: {
        readonly crumbLabel: string
        readonly crumbs: ReadonlyArray<BreadcrumbItem>
        readonly title: string
        readonly mainLabel: string
        readonly railLabel: string
        readonly steps: ReadonlyArray<{ readonly id: string; readonly title: string }>
    }
}

const TILES = ["token", "followers", "agents"].map((id) => ({ id, term: "-", description: "-", meta: "-" }))

/**
 * STATE-8: a provider connection page with no data yet, in its own frame - the header band over the main pane and the rail; the
 * trail, the step titles and the rail heading are real, the name, the facts, the tiles and the events are inert geometry.
 */
export const ConnectionPageLoading = (props: ConnectionPageLoadingProps) => (
    <Page
        chrome="panes"
        measure="product"
        isSkeleton
        header={{
            breadcrumbs: { label: props.props.crumbLabel, items: [...props.props.crumbs] },
            title: props.props.title,
            meta: <Skeleton shape="text" />,
        }}
    >
        <PaneGrid
            label={props.props.title}
            areas={{ base: ["main"], medium: ["main rail"] }}
            columns={{ base: ["fill"], medium: ["fill", "standard"] }}
        >
            <Pane area="main" surface scroll label={props.props.mainLabel}>
                <PaneSection>
                    <DescriptionList layout="stat-strip" isDivided isLoading items={TILES} />
                </PaneSection>
                {props.props.steps.map((step, index) => (
                    <PaneSection key={step.id}>
                        <SectionHeader
                            level={2}
                            title={
                                <>
                                    <LeadingNumber position={index + 1} /> {step.title}
                                </>
                            }
                        />
                    </PaneSection>
                ))}
            </Pane>
            <Pane area="rail" surface scroll label={props.props.railLabel}>
                <PaneSection as="header">
                    <SectionHeader level={2} title={props.props.railLabel} />
                </PaneSection>
                <PaneSection>
                    <Skeleton shape="text" lines={3} />
                </PaneSection>
            </Pane>
        </PaneGrid>
    </Page>
)
