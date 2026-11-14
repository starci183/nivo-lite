import { Button, Drawer, Stack, SurfaceCard } from "@starci/grammar/common"
import { AgentWorkflowTemplate, type AgentWorkflowTemplateCopy } from "@/components/composites/AgentWorkflowTemplate"
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

/** One template as a row of the choice: its name, and under it what it does with its version and what it needs. */
const itemOf = (template: WorkflowTemplateRowView) => ({
    id: template.id,
    title: template.name,
    subtitle: [template.summary, template.meta, template.needs].filter((part) => part !== "").join(" · "),
})

/**
 * The drawer that makes a workflow from a template: the templates of the kind of agent as a choice list (a select card, one row per
 * template), the one chosen with the map of its newest version, and the one primary "Create workflow". The new workflow keeps its own copy of the map.
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
                <SurfaceCard
                    kind="select"
                    selectionMode="single"
                    label={copy.pick}
                    headingLevel={3}
                    items={props.props.templates.map((template) => itemOf(template))}
                    value={create.selectedId === "" ? null : create.selectedId}
                    onChange={props.on.pick}
                />
                {create.detail === null ? null : <AgentWorkflowTemplate props={{ copy: copy.template, template: create.detail, hasIntro: false }} />}
            </Stack>
        </Drawer>
    )
}
