import { Badge, Button, DescriptionList, SectionHeader, SurfaceCard, Text } from "@starci/grammar/common"
import { AdminSupportActions } from "@/components/blocks/AdminSupportActions"
import { AdminRowsCard } from "@/components/composites/AdminRowsCard"
import type { AdminCardView, AdminFactView, AdminInviteRef } from "@/hooks/admin"
import { ADMIN_ROUTES } from "@/modules/routes"
import { FACTS_CLASS_NAME, GRID_CLASS_NAME } from "./classNames"

/** Copy and values the workspace overview page supplies. */
export interface AdminWorkspacePageBaseProps {
    readonly props: {
        readonly eyebrow: string
        readonly title: string
        readonly description: string
        readonly allWorkspacesLabel: string
        readonly overviewTitle: string
        readonly billing: ReadonlyArray<AdminFactView>
        readonly activity: ReadonlyArray<AdminFactView>
        readonly workspaceId: string
        readonly status: string
        readonly planCode: string | null
        readonly creditsLimit: number | null
        readonly invites: ReadonlyArray<AdminInviteRef>
        readonly cards: ReadonlyArray<AdminCardView>
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

/** Draws the read-only overview of one workspace, the confirmed support actions and the lists under them. */
export const AdminWorkspacePageBase = (props: AdminWorkspacePageBaseProps) => (
    <>
        <SectionHeader
            level={1}
            eyebrow={props.props.eyebrow}
            title={props.props.title}
            description={props.props.description}
            action={
                <Button variant="ghost" href={ADMIN_ROUTES.workspaces}>
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
        <AdminSupportActions
            workspaceId={props.props.workspaceId}
            status={props.props.status}
            planCode={props.props.planCode}
            creditsLimit={props.props.creditsLimit}
            invites={props.props.invites}
        />
        <div className={GRID_CLASS_NAME}>
            {props.props.cards.map((card) => (
                <AdminRowsCard key={card.id} card={card} />
            ))}
        </div>
    </>
)
