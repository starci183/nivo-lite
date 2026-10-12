import { PageContainer } from "@starci/grammar/common"
import { OverviewBase } from "@/features/overview/component"

/** STATE-8: the Overview itself, with no data yet - the same headings, KPI cards, owner groups and rail, every figure and row as a skeleton. */
const DashboardLoading = () => (
  <PageContainer measure="product">
    <OverviewBase
      isLoading
      title=""
      updatedLabel=""
      verifiedLabel=""
      groups={[]}
      groupTotal={0}
      counts={{ open: 0, waitingApproval: 0, dueToday: 0, overdue: 0, leadsThisWeek: 0 }}
      governance={null}
      waiting={[]}
      agents={[]}
      activity={[]}
      hasAgents={false}
      promo={null}
    />
  </PageContainer>
)

export default DashboardLoading
