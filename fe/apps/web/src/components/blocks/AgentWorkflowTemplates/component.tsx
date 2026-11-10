import { Badge, Cluster, Dialog, EmptyNotice, SurfaceCard, Text, type ListRowData } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { AgentWorkflowTemplate, type AgentWorkflowTemplateCopy } from "@/components/composites/AgentWorkflowTemplate"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { DataSlot, SlotLabels, WorkflowTemplateDetailView, WorkflowTemplateRowView } from "@/modules/types"

/** The templates of the market, the one opened, the words and the commands. */
export interface AgentWorkflowTemplatesBaseProps {
    readonly props: {
        readonly title: string
        readonly empty: string
        readonly close: string
        readonly template: AgentWorkflowTemplateCopy
        readonly slot: DataSlot<ReadonlyArray<WorkflowTemplateRowView>>
        readonly placeholder: ReadonlyArray<WorkflowTemplateRowView>
        readonly slotLabels: SlotLabels
        /** The template whose detail is open, or null. */
        readonly detail: WorkflowTemplateDetailView | null
    }
    readonly on: {
        readonly open: (id: string) => void
        readonly close: () => void
        readonly retry: () => void
    }
}

/** The line under a template's summary: the kind of agent (grey), what starts it (info), then the version and the shops that use it, muted. */
const chipsOf = (template: WorkflowTemplateRowView) => (
    <Cluster gap="inline" align="center">
        <Badge tone="neutral">{template.role}</Badge>
        {template.source === "" ? null : <Badge tone="info">{template.source}</Badge>}
        <Text size="xs" tone="muted">
            {"· " + template.meta}
        </Text>
    </Cluster>
)

/** One template as a row: its icon tile, name, one line of what it does and its chips; the whole row opens it. */
const rowOf = (props: AgentWorkflowTemplatesBaseProps, template: WorkflowTemplateRowView): ListRowData => ({
    id: template.id,
    title: template.name,
    description: template.summary,
    leading: { icon: nivoIconSource("overview", "leading") },
    detail: chipsOf(template),
    onPress: () => props.on.open(template.id),
})

/**
 * The workflow templates of the market as one list card (its title and count above), and the detail of one on a dialog: the
 * map of its newest version and what each version changed.
 */
export const AgentWorkflowTemplatesBase = (props: AgentWorkflowTemplatesBaseProps) => (
    <>
        <SlotView
            slot={props.props.slot}
            placeholder={props.props.placeholder}
            labels={{ ...props.props.slotLabels, empty: props.props.empty }}
            onRetry={props.on.retry}
            render={(templates, isLoading) => (
                <SurfaceCard
                    kind="list"
                    label={props.props.title}
                    headingLevel={2}
                    count={templates.length}
                    isLoading={isLoading}
                    empty={<EmptyNotice message={props.props.empty} iconSource={nivoIconSource("overview", "leading")} />}
                    items={templates.map((template) => rowOf(props, template))}
                />
            )}
        />
        <Dialog
            title={props.props.detail?.name ?? props.props.title}
            isOpen={props.props.detail !== null}
            onOpenChange={(isOpen) => {
                if (!isOpen) props.on.close()
            }}
            closeLabel={props.props.close}
            size="lg"
        >
            {props.props.detail === null ? null : (
                <AgentWorkflowTemplate props={{ copy: props.props.template, template: props.props.detail, hasIntro: true }} />
            )}
        </Dialog>
    </>
)
