import {
    DescriptionList,
    EmptyNotice,
    Page,
    Pane,
    PaneGrid,
    PaneSection,
    Section,
    Stepper,
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

const TILES = ["token", "followers", "agents"].map((id) => ({ id, term: "-", description: "-" }))

/**
 * STATE-8: a provider connection page with no data yet, in its own frame - the header band over the main pane and the rail; the
 * trail, the step titles and the rail heading are real, the name, the facts, the tiles and the events are inert geometry.
 */
export const ConnectionPageLoading = (props: ConnectionPageLoadingProps) => (
    <Page
        chrome="panes"
        measure="product"
        isLoading
        header={{
            breadcrumbs: { label: props.props.crumbLabel, items: [...props.props.crumbs] },
            title: props.props.title,
        }}
    >
        <PaneGrid
            label={props.props.title}
            areas={{ base: ["main"], medium: ["main rail"] }}
            columns={{ base: ["fill"], medium: ["fill", "standard"] }}
        >
            <Pane area="main" surface scroll label={props.props.mainLabel}>
                <PaneSection>
                    <DescriptionList layout="columns" isDivided isLoading items={TILES} />
                </PaneSection>
                <PaneSection isLoading>
                    <Stepper
                        label={props.props.mainLabel}
                        orientation="vertical"
                        currentStepId=""
                        steps={props.props.steps.map((step) => ({ id: step.id, label: step.title }))}
                    />
                </PaneSection>
            </Pane>
            <Pane area="rail" surface scroll label={props.props.railLabel}>
                <PaneSection isLoading>
                    <Section
                        title={props.props.railLabel}
                        kind="list"
                        items={[]}
                        empty={<EmptyNotice message={props.props.railLabel} />}
                    />
                </PaneSection>
            </Pane>
        </PaneGrid>
    </Page>
)
