import { Page, Stack, type BreadcrumbItem } from "@starci/grammar/common"
import { AgentCatalog } from "@/components/blocks/AgentCatalog"
import { AgentCreateAction } from "@/components/blocks/AgentCreateAction"
import { AgentCreateDialog } from "@/components/blocks/AgentCreateDialog"
import { AgentWorkWorkspaceSwitch } from "@/components/blocks/AgentWorkWorkspaceSwitch"
import { AgentWorkflowTemplates } from "@/components/blocks/AgentWorkflowTemplates"

/** Copy and slots of the agent catalogue page. */
export interface AgentsCatalogPageBaseProps {
    readonly props: {
        readonly crumbLabel: string
        readonly crumbs: ReadonlyArray<BreadcrumbItem>
        readonly title: string
        readonly description: string
    }
}

/**
 * Draws the catalogue page: one Page, the trail, heading and the create action (for the people who may install) in its header, the
 * catalogue block and the workflow templates of the installed packages as its body.
 */
export const AgentsCatalogPageBase = (props: AgentsCatalogPageBaseProps) => (
    <Page
        measure="product"
        header={{
            title: props.props.title,
            description: props.props.description,
            breadcrumbs: { label: props.props.crumbLabel, items: props.props.crumbs },
            actions: <AgentCreateAction />,
        }}
    >
        <Stack gap="section">
            <AgentCatalog />
            <AgentWorkflowTemplates />
        </Stack>
        <AgentWorkWorkspaceSwitch />
        <AgentCreateDialog />
    </Page>
)
