import { Page, Pane, PaneGrid } from "@starci/grammar/common"
import type { PageHeaderBreadcrumbs } from "@starci/grammar/common"
import { AuthorityGoals } from "@/components/blocks/AuthorityGoals"
import { AuthorityLimits } from "@/components/blocks/AuthorityLimits"
import { AuthorityMainHead } from "@/components/blocks/AuthorityMainHead"
import { AuthorityPolicies } from "@/components/blocks/AuthorityPolicies"
import { AuthorityReadOnly } from "@/components/blocks/AuthorityReadOnly"
import { AuthorityScope } from "@/components/blocks/AuthorityScope"
import { AuthoritySections } from "@/components/blocks/AuthoritySections"
import { AuthorityStaff } from "@/components/blocks/AuthorityStaff"
import { PaneHead } from "@/components/composites/PaneHead"
import { PaneBody } from "@/components/frames/PaneBody"
import type { AuthoritySectionId } from "@/modules/authority"
import type { PaneGridLayout } from "@/modules/types"

/** What the authority page is told: its words, the arrangement of its panes and the section that is open. */
export interface AuthorityPageBaseProps {
    readonly props: {
        /** The trail: the dashboard, then the authority page. */
        readonly breadcrumbs: PageHeaderBreadcrumbs
        readonly title: string
        readonly description: string
        readonly gridLabel: string
        readonly listTitle: string
        readonly listLabel: string
        readonly detailLabel: string
        readonly grid: PaneGridLayout
        readonly open: AuthoritySectionId
        /** The ids of the five sections, in the order of the operating flow. */
        readonly sections: ReadonlyArray<AuthoritySectionId>
    }
}

/** Draws the authority page as list and detail: the five sections beside the open one's form, each section its own address. */
export const AuthorityPageBase = (props: AuthorityPageBaseProps) => {
    const view = props.props
    return (
        <Page chrome="panes" header={{ breadcrumbs: view.breadcrumbs, title: view.title, description: view.description }}>
            <PaneGrid label={view.gridLabel} areas={view.grid.areas} columns={view.grid.columns} rows={view.grid.rows}>
                <Pane area="listHead" surface>
                    <PaneHead title={view.listTitle} />
                </Pane>
                <Pane area="list" surface scroll label={view.listLabel}>
                    <PaneBody>
                        <AuthoritySections sections={view.sections} selected={view.open} />
                    </PaneBody>
                </Pane>
                <Pane area="head" surface>
                    <AuthorityMainHead section={view.open} />
                </Pane>
                <Pane area="main" scroll content="cards" label={view.detailLabel}>
                    <PaneBody>
                        <AuthorityReadOnly />
                        {view.open === "goals" ? <AuthorityGoals /> : null}
                        {view.open === "policies" ? <AuthorityPolicies /> : null}
                        {view.open === "scope" ? <AuthorityScope /> : null}
                        {view.open === "limits" ? <AuthorityLimits /> : null}
                        {view.open === "staff" ? <AuthorityStaff /> : null}
                    </PaneBody>
                </Pane>
            </PaneGrid>
        </Page>
    )
}
