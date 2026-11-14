import { EmptyNotice, Link, Section, SurfaceCard } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { OverviewApprovalView } from "@/modules/types"

/** What the approvals card is told. */
interface OverviewApprovalsCardProps {
    readonly props: {
        readonly title: string
        /** How many items wait, or null when none does. */
        readonly count: number | null
        readonly moreLabel: string
        readonly emptyTitle: string
        readonly emptyBody: string
        readonly items: ReadonlyArray<OverviewApprovalView>
        /** More items wait than the card lists. */
        readonly hasMore: boolean
        readonly isLoading: boolean
    }
    readonly on: {
        /** Opens one item in the workbench of its agent. */
        readonly open: (href: string) => void
    }
    /** The team chat, where every item that waits is. */
    readonly allHref: string
}

/** What waits for the owner across every agent: the oldest items, each opening in its agent's workbench, and the way to the rest. */
export const OverviewApprovalsCard = (props: OverviewApprovalsCardProps) => {
    const copy = props.props
    return (
        <Section
            title={copy.title}
            headingLevel={2}
            isLoading={copy.isLoading}
            {...(copy.count === null ? {} : { count: copy.count, isAttention: true })}
            {...(copy.count === null
                ? {}
                : {
                      action: (
                          <Link variant="head" href={props.allHref}>
                              {copy.moreLabel}
                          </Link>
                      ),
                  })}
        >
            <SurfaceCard
                kind="list"
                ariaLabel={copy.title}
                height="fill"
                isLoading={copy.isLoading}
                items={copy.items.map((item) => ({
                    id: item.id,
                    title: item.title,
                    description: item.description,
                    leading: { icon: nivoIconSource("review", "leading"), size: "sm" as const },
                    onPress: () => props.on.open(item.href),
                }))}
                empty={<EmptyNotice message={copy.emptyTitle} description={copy.emptyBody} />}
            />
        </Section>
    )
}
