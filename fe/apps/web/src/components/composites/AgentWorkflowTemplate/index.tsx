import { FlowGraph, FlowGraphLegend, Section, Stack, Text } from "@starci/grammar/common"
import type { WorkflowTemplateDetailView } from "@/modules/types"

/** The words of the detail of one template. */
export interface AgentWorkflowTemplateCopy {
    readonly mapTitle: string
    readonly mapLabel: string
    readonly mapCaption: string
    /** Over the changelog; empty leaves the changelog out (the maker only previews the map). */
    readonly changelogTitle: string
    readonly noChanges: string
}

/** What the detail of a template draws. */
interface AgentWorkflowTemplateProps {
    readonly props: {
        readonly copy: AgentWorkflowTemplateCopy
        readonly template: WorkflowTemplateDetailView
        /** Whether the summary and the facts open the detail (the maker already shows them in its list). */
        readonly hasIntro: boolean
    }
}

/**
 * One template on a drawer or dialog: what it does and needs, the map of its newest version, and what each version changed. It stands
 * on the overlay, so no card.
 */
export const AgentWorkflowTemplate = (props: AgentWorkflowTemplateProps) => {
    const { copy, template } = props.props
    return (
        <Stack gap="section">
            {props.props.hasIntro ? (
                <Stack gap="identity">
                    <Text>{template.summary}</Text>
                    <Text size="sm" tone="muted">
                        {[template.meta, template.needs].filter((part) => part !== "").join(" · ")}
                    </Text>
                </Stack>
            ) : null}
            <Section title={copy.mapTitle} headingLevel={3} caption={copy.mapCaption}>
                <Stack gap="inline">
                    <FlowGraph
                        label={copy.mapLabel}
                        nodes={template.flow.nodes}
                        edges={template.flow.edges}
                        layout="steps"
                        statusLabels={template.flow.statusLabels}
                        isInteractive={false}
                        fit="contain"
                        height="lg"
                    />
                    <FlowGraphLegend items={template.flow.legend} />
                </Stack>
            </Section>
            {copy.changelogTitle === "" ? null : (
                <Section title={copy.changelogTitle} headingLevel={3}>
                    <Stack gap="inline">
                        {template.versions.map((version) => (
                            <Stack key={version.version} gap="identity">
                                <Text isStrong>{version.title}</Text>
                                {version.changes.length === 0 ? (
                                    <Text size="sm" tone="muted">
                                        {copy.noChanges}
                                    </Text>
                                ) : (
                                    version.changes.map((line) => (
                                        <Text key={line} size="sm" tone="muted">
                                            {line}
                                        </Text>
                                    ))
                                )}
                            </Stack>
                        ))}
                    </Stack>
                </Section>
            )}
        </Stack>
    )
}
