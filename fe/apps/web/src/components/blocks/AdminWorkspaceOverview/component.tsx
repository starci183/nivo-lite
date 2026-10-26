import { Badge, Button, DescriptionList, SectionHeader, SurfaceCard, Text } from "@starci/grammar/common"
import type { AdminFactView } from "@/hooks/admin"
import { ADMIN_ROUTES } from "@/modules/routes"
import { FACTS_CLASS_NAME } from "./classNames"
import { AdminLoadState } from "@/components/composites/AdminLoadState"
import type { AdminLoad } from "@/components/composites/AdminLoadState"

/** Copy and values the connected workspace overview supplies. */
interface AdminWorkspaceOverviewViewProps {
    readonly props: {
        readonly eyebrow: string
        readonly title: string
        readonly description: string
        readonly allWorkspacesLabel: string
        readonly overviewTitle: string
        readonly billing: ReadonlyArray<AdminFactView>
        readonly activity: ReadonlyArray<AdminFactView>
    }
}

const termsOf = (facts: ReadonlyArray<AdminFactView>) =>
    facts.map((fact) => ({
        id: fact.id,
        term: fact.term,
        description:
            fact.tone === undefined ? (
                <Text weight="medium">{fact.value}</Text>
            ) : (
                <Badge tone={fact.tone}>{fact.value}</Badge>
            ),
    }))

/** Draws the read-only overview of one workspace: its heading and the billing and activity facts. */
const AdminWorkspaceOverviewView = (props: AdminWorkspaceOverviewViewProps) => (
    <>
        <SectionHeader
            level={1}
            eyebrow={props.props.eyebrow}
            title={props.props.title}
            description={props.props.description}
            action={
                <Button intent="neutral" href={ADMIN_ROUTES.workspaces}>
                    {props.props.allWorkspacesLabel}
                </Button>
            }
        />
        <SurfaceCard label={props.props.overviewTitle} headingLevel={2}>
            <div className={FACTS_CLASS_NAME}>
                <DescriptionList layout="columns" isDivided items={termsOf(props.props.billing)} />
                <DescriptionList layout="columns" isDivided items={termsOf(props.props.activity)} />
            </div>
        </SurfaceCard>
    </>
)

/** The workspace read and, once it arrived, the view it draws. */
export interface AdminWorkspaceOverviewBaseProps {
    readonly props: {
        readonly load: AdminLoad
        readonly view: AdminWorkspaceOverviewViewProps["props"] | undefined
    }
}

/** Draws the loading state, the failure or the finished view of the connected read. */
export const AdminWorkspaceOverviewBase = (props: AdminWorkspaceOverviewBaseProps) => (
    <AdminLoadState {...props.props.load}>
        {props.props.view === undefined ? null : <AdminWorkspaceOverviewView props={props.props.view} />}
    </AdminLoadState>
)
