import {
    Badge,
    Button,
    DescriptionList,
    Disclosure,
    EmptyNotice,
    Link,
    Section,
    Text,
    Stack,
    Cluster,
    FilterButtonGroup,
} from "@starci/grammar/common"
import type { ListRowData } from "@starci/grammar/common"
import type { FindingAction, FindingRowView } from "@/hooks/brain"

export type { FindingAction, FindingRowView } from "@/hooks/brain"

/** What the rows say and call. */
interface DossierFindingRowsProps {
    readonly label: string
    readonly rows: ReadonlyArray<FindingRowView>
    readonly isSkeleton: boolean
    readonly onAction: (findingId: string, action: FindingAction) => void
    readonly filterLabel: string
    readonly filters: ReadonlyArray<{ readonly value: string; readonly label: string }>
    readonly filter: string
    readonly onFilterChange: (value: string) => void
}

/** The evidence of a finding as static rows, with a link to each document it comes from. */
const Evidence = (props: Pick<FindingRowView, "id" | "evidenceTitle" | "evidence" | "sources">) => (
    <Disclosure
        title={props.evidenceTitle}
        headingLevel={4}
        body={
            <Stack gap="row">
                <DescriptionList
                    layout="stacked"
                    items={props.evidence.map((item) => ({
                        id: item.id,
                        term: item.label,
                        description: item.description ?? "",
                    }))}
                />
                <Cluster gap="row">
                    {props.sources.map((source) => (
                        <Link key={source.id} href={source.href}>
                            {source.label}
                        </Link>
                    ))}
                </Cluster>
            </Stack>
        }
    />
)

/** One row and what its actions call. */
interface RowDetailProps {
    readonly row: FindingRowView
    readonly onAction: DossierFindingRowsProps["onAction"]
}

/** The meta line, the evidence and the actions that belong to one row. */
const RowDetail = (props: RowDetailProps) => (
    <Stack gap="row">
        {props.row.badges.length <= 2 ? null : (
            <Cluster gap="inline">
                {props.row.badges.slice(2).map((badge) => (
                    <Badge key={badge.id} tone={badge.tone}>
                        {badge.label}
                    </Badge>
                ))}
            </Cluster>
        )}
        {props.row.meta === null ? null : <Text tone="muted">{props.row.meta}</Text>}
        {props.row.evidence.length === 0 ? null : <Evidence {...props.row} />}
        {props.row.actions.length === 0 ? null : (
            <Cluster gap="inline">
                {props.row.actions.map((action) =>
                    action.href === null ? (
                        <Button
                            key={action.id}
                            size="sm"
                            intent="neutral"
                            onPress={() => props.onAction(props.row.id, action.id)}
                        >
                            {action.label}
                        </Button>
                    ) : (
                        <Button key={action.id} size="sm" intent="neutral" href={action.href}>
                            {action.label}
                        </Button>
                    ),
                )}
            </Cluster>
        )}
    </Stack>
)

/** The badges a row carries, capped at the two a list row draws; the rest follow in the detail. */
const badgesOf = (badges: FindingRowView["badges"]): Pick<ListRowData, "badges"> => {
    const [first, second] = badges.map((badge) => ({ label: badge.label, tone: badge.tone }))
    if (first === undefined) return {}
    return second === undefined ? { badges: [first] } : { badges: [first, second] }
}

/** One finding as row data: the title leads to its dossier where the address has one. */
const itemOf = (row: FindingRowView, onAction: DossierFindingRowsProps["onAction"]): ListRowData => ({
    id: row.id,
    title: row.title,
    description: row.detail,
    state: row.isFocused ? "informative" : "neutral",
    ...badgesOf(row.badges),
    ...(row.titleHref === null ? {} : { href: row.titleHref }),
    detail: <RowDetail row={row} onAction={onAction} />,
})

/**
 * The findings of the dossier review as rows of one list: severity, kind and AI badges, the title (a link where the row leads
 * to its dossier), the detail as the one description line, then the owner, the evidence and the actions under it. Shared by the
 * pane of one dossier and the list of what needs doing.
 */
export const DossierFindingRows = (props: DossierFindingRowsProps) => (
    <Section
        kind="list"
        title={props.label}
        filter={
            <FilterButtonGroup
                label={props.filterLabel}
                options={props.filters}
                value={props.filter}
                onValueChange={props.onFilterChange}
            />
        }
        isLoading={props.isSkeleton}
        empty={<EmptyNotice message={props.label} />}
        items={props.rows.map((row) => itemOf(row, props.onAction))}
    />
)
