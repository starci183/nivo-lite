import { useState } from "react"
import { Badge, Cluster, EmptyNotice, IdentityLockup, SurfaceCard, Text, type TableRowData } from "@starci/grammar/common"
import { ConnectionLastEvent } from "@/components/composites/ConnectionLastEvent"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { ConnectionsListView } from "@/modules/types"
import type { ConnectionsHomeBaseProps, ConnectionsHomeCommands } from "./types"

/** How many connections one page of the table holds. */
const PAGE_SIZE = 10

type HomeProps = ConnectionsHomeBaseProps["props"]

/** What the table needs. */
interface ConnectionsTableProps {
    readonly props: HomeProps
    readonly on: ConnectionsHomeCommands
    readonly view: ConnectionsListView
    readonly isLoading: boolean
}

/** One table row per connection: the lockup with its status, the last event and the agents; the whole row opens its page. */
const tableRowsOf = (data: HomeProps, rows: HomeProps["rows"]): ReadonlyArray<TableRowData> => {
    const { copy } = data
    return rows.map((row) => ({
        id: row.id,
        href: row.href,
        cells: {
            connection: (
                <Cluster gap="inline" wrap>
                    <IdentityLockup
                        title={row.name}
                        subtitle={row.description}
                        {...(row.logo.src === undefined ? {} : { logoSrc: row.logo.src })}
                        markShape="rounded"
                    />
                    {row.status.label === "" ? null : (
                        <Badge tone={row.status.tone} isDot={row.status.isDot}>
                            {row.status.label}
                        </Badge>
                    )}
                </Cluster>
            ),
            lastEvent: (
                <ConnectionLastEvent
                    at={row.lastEventAt}
                    outcome={row.isFailed ? "failed" : "ok"}
                    locale={data.locale}
                    failedLabel={copy.lastEventFailed}
                    noneLabel={copy.lastEventNone}
                />
            ),
            agent: (
                <Text size="sm" overflow="truncate">
                    {row.agents === "" ? copy.agentNone : row.agents}
                </Text>
            ),
        },
    }))
}

/** The numbers of the pager for the page shown. */
const pagerOf = (total: number, page: number) => {
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
    const current = Math.min(page, pageCount)
    const from = (current - 1) * PAGE_SIZE
    return { pageCount, current, from, to: Math.min(total, from + PAGE_SIZE) }
}

/** Every connection in one card: the filter tabs and the search in its header, the rows, and the pager under them. */
export const ConnectionsTable = (props: ConnectionsTableProps) => {
    const { copy } = props.props
    const [page, setPage] = useState(1)
    const total = props.props.rows.length
    const pager = pagerOf(total, page)
    return (
        <SurfaceCard
            kind="table"
            label={copy.allHeading}
            count={props.view.rows.length}
            isLoading={props.isLoading}
            headers={[
                {
                    kind: "filter",
                    label: copy.filterLabel,
                    items: props.view.filters.map((choice) => ({
                        id: choice.value,
                        label: choice.label,
                        count: choice.count,
                        ...(choice.value === "attention" && choice.count > 0 ? { isAttention: true } : {}),
                    })),
                    selectedKey: props.props.filter,
                    onSelect: props.on.filter,
                    moreLabel: (count) => copy.moreFilters.replace("{count}", String(count)),
                },
                {
                    kind: "search",
                    label: copy.searchLabel,
                    placeholder: copy.searchLabel,
                    clearLabel: copy.clearLabel,
                    value: props.props.text,
                    onChange: props.on.text,
                },
            ]}
            columns={[
                { id: "connection", label: copy.colConnection },
                { id: "lastEvent", label: copy.colLastEvent, priority: "low" },
                { id: "agent", label: copy.colAgent, priority: "low" },
            ]}
            rows={tableRowsOf(props.props, props.props.rows.slice(pager.from, pager.from + PAGE_SIZE))}
            footers={
                total > 0
                    ? [
                          {
                              kind: "paging" as const,
                              page: pager.current,
                              pageCount: pager.pageCount,
                              onPage: setPage,
                              labels: {
                                  nav: copy.paging.nav,
                                  previous: copy.paging.previous,
                                  next: copy.paging.next,
                                  page: (number) => copy.paging.pageTemplate.replace("{page}", String(number)),
                                  summary: copy.paging.summaryTemplate
                                      .replace("{from}", String(pager.from + 1))
                                      .replace("{to}", String(pager.to))
                                      .replace("{total}", String(total)),
                              },
                          },
                      ]
                    : []
            }
            empty={
                <EmptyNotice
                    message={copy.noMatchTitle}
                    iconSource={nivoIconSource("search", "leading")}
                    description={copy.noMatchBody}
                    actionLabel={copy.clearFilters}
                    onAction={props.on.clearFilters}
                />
            }
        />
    )
}
