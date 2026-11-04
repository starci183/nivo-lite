import {
    Badge,
    Cluster,
    Disclosure,
    Pane,
    PaneGrid,
    PaneHeader,
    PaneSection,
    Section,
    SurfaceCard,
    Text,
} from "@starci/grammar/common"

/** The words of the workbench that do not depend on the agent: the side pane's title and its three collapsed rows. */
export interface AgentWorkbenchLoadingPageBaseProps {
    readonly props: {
        readonly title: string
        readonly waitingTitle: string
        readonly regions: ReadonlyArray<{ readonly id: string; readonly label: string }>
    }
}

/** The figures' terms are unknown before the read, so the four cells draw as geometry. */
const FIGURES = ["a", "b", "c", "d"].map((id) => ({ id, term: "-", value: "-", meta: "-" }))

/** The tabs' names are unknown before the read: four lines stand for them. */
const TABS = ["a", "b", "c", "d"]

/**
 * The workbench while it loads, in the shape of the ready one: the tabs band, the figures and the list of the work, and the side pane
 * with its title kept, its decisions as rows and its three collapsed rows with their real titles. Every region is a skeleton at once.
 */
export const AgentWorkbenchLoadingPageBase = (props: AgentWorkbenchLoadingPageBaseProps) => (
    <PaneGrid
        label={props.props.title}
        areas={{ base: ["head", "main"], wide: ["head asideHead", "main aside"] }}
        columns={{ base: ["fill"], wide: ["fill", "standard"] }}
        rows={{ base: ["auto", "fill"], wide: ["auto", "fill"] }}
    >
        <Pane area="head" surface>
            <PaneSection align="center" isLoading>
                <Cluster gap="row">
                    {TABS.map((id) => (
                        <Text key={id} size="md">
                            {"-"}
                        </Text>
                    ))}
                </Cluster>
            </PaneSection>
        </Pane>
        <Pane area="main" scroll label={props.props.title}>
            <PaneSection gap="section" isLoading>
                <SurfaceCard kind="figures" ariaLabel={props.props.title} items={FIGURES} />
                <Section kind="list" title={props.props.title} items={[]} empty={null} />
            </PaneSection>
        </Pane>
        <Pane area="asideHead" surface>
            <PaneSection align="center">
                <PaneHeader title={props.props.waitingTitle} />
            </PaneSection>
        </Pane>
        <Pane area="aside" surface label={props.props.waitingTitle}>
            <PaneSection scroll={{ label: props.props.waitingTitle }} isLoading>
                <Section kind="list" title={props.props.waitingTitle} headingLevel={3} items={[]} empty={null} />
            </PaneSection>
            <PaneSection gap="inline">
                {props.props.regions.map((region) => (
                    <Disclosure
                        key={region.id}
                        title={region.label}
                        summary={
                            <Badge tone="neutral" isLoading>
                                {"-"}
                            </Badge>
                        }
                        body={null}
                    />
                ))}
            </PaneSection>
        </Pane>
    </PaneGrid>
)
