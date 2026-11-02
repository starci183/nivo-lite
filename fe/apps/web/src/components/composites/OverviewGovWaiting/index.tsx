import { EmptyNotice, Link, SurfaceCard, Text, type ListRowData } from "@starci/grammar/common"
import type { GovWaitingItem } from "@/hooks/overviewGov"

/** The settled waiting rows, with one unresolved drawing flag for the containing overview. */
export interface OverviewGovWaitingProps {
    readonly figures: {
        readonly title: string
        readonly openLabel: string | null
        readonly chatHref: string
        readonly none: string
        readonly count: string
        readonly items: ReadonlyArray<GovWaitingItem>
        readonly more: string | null
        readonly source: string
    }
    readonly isLoading?: boolean
}

/** Keeps the oldest decisions, their count and source in one bounded collection with one heading. */
export const OverviewGovWaiting = (props: OverviewGovWaitingProps) => {
    const { figures } = props
    return (
        <SurfaceCard
            kind="list"
            label={figures.title}
            isLoading={props.isLoading === true}
            {...(figures.items.length === 0 ? {} : { fact: figures.count })}
            labelEnd={figures.openLabel === null ? undefined : <Link href={figures.chatHref}>{figures.openLabel}</Link>}
            empty={<EmptyNotice message={figures.none} />}
            footer={
                <Text size="xs" tone="muted" isLoading={props.isLoading === true}>
                    {[
                        figures.openLabel !== null && figures.items.length > 0 ? figures.count : "",
                        figures.more ?? "",
                        figures.source,
                    ]
                        .filter((line) => line !== "")
                        .join(" · ")}
                </Text>
            }
            items={figures.items.map((item): ListRowData => ({
                id: item.id,
                title: item.title,
                ...(item.summary == null ? {} : { description: item.summary }),
                badges:
                    item.reason === null
                        ? [{ label: item.department, tone: "neutral" }]
                        : [
                              { label: item.department, tone: "neutral" },
                              { label: item.reason, tone: "warning" },
                          ],
                ...(figures.openLabel === null ? {} : { action: { label: figures.openLabel, href: figures.chatHref } }),
            }))}
        />
    )
}
