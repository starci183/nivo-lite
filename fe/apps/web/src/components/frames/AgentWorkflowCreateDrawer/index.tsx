import { Button, Drawer, ListBox, Section, Stack } from "@starci/grammar/common"
import type { ListBoxItem } from "@starci/grammar/common"
import { AgentWorkflowTemplate } from "@/components/composites/AgentWorkflowTemplate"
import type { AgentWorkflowTemplateCopy } from "@/components/composites/AgentWorkflowTemplate"
import { Icon } from "@/components/leaves/Icon"
import type { WorkflowCreateView, WorkflowTemplateRowView } from "@/modules/types"

/** The words of the maker. */
export interface AgentWorkflowCreateDrawerCopy {
    readonly title: string
    readonly pick: string
    readonly submit: string
    readonly closeLabel: string
    readonly template: AgentWorkflowTemplateCopy
}

/** What the maker draws and what it does. */
interface AgentWorkflowCreateDrawerProps {
    readonly props: {
        readonly copy: AgentWorkflowCreateDrawerCopy
        readonly create: WorkflowCreateView
        readonly templates: ReadonlyArray<WorkflowTemplateRowView>
        readonly isLoading: boolean
    }
    readonly on: {
        readonly close: () => void
        readonly pick: (id: string) => void
        readonly submit: () => void
    }
}

/** One template: its name and what it does. */
const itemOf = (template: WorkflowTemplateRowView): ListBoxItem => ({
    id: template.id,
    label: template.name,
    description: template.summary,
    footer: [template.meta, template.needs].filter((part) => part !== "").join(" · "),
})

/**
 * The drawer that makes a workflow from a template: the templates of the kind of agent, the one chosen with the map of its newest
 * version, and the one primary "Create workflow". The new workflow keeps its own copy of the map.
 */
export const AgentWorkflowCreateDrawer = (props: AgentWorkflowCreateDrawerProps) => {
    const { copy, create } = props.props
    return (
        <Drawer
            title={copy.title}
            isOpen={create.isOpen}
            onOpenChange={(isOpen) => {
                if (!isOpen) props.on.close()
            }}
            closeLabel={copy.closeLabel}
            width="wide"
            isLoading={props.props.isLoading}
            footer={
                <Button
                    intent="commit"
                    startContent={<Icon props={{ name: "add", usage: "leading" }} />}
                    isDisabled={create.detail === null}
                    isPending={create.isCreating}
                    onPress={props.on.submit}
                >
                    {copy.submit}
                </Button>
            }
        >
            <Stack gap="section">
                <Section title={copy.pick} headingLevel={3}>
                    <ListBox
                        label={copy.pick}
                        items={props.props.templates.map(itemOf)}
                        selectionMode="single"
                        selectedIds={[create.selectedId]}
                        selectionIndicator="none"
                        onSelectionChange={(ids) => {
                            const [id] = ids
                            if (id !== undefined) props.on.pick(id)
                        }}
                    />
                </Section>
                {create.detail === null ? null : <AgentWorkflowTemplate props={{ copy: copy.template, template: create.detail, hasIntro: false }} />}
            </Stack>
        </Drawer>
    )
}
