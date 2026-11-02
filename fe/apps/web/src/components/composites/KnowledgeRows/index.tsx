import type { ReactNode } from "react"
import { Alert, Badge, Cluster, EmptyNotice, Section, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import type { ListRowData } from "@starci/grammar/common"
import { KnowledgeProgressRow } from "@/components/branches/KnowledgeProgressRow"
import { KnowledgeRowActions } from "@/components/branches/KnowledgeRowActions"
import type { KnowledgeListView, KnowledgeRowView } from "@/modules/types"

/** The same resolved row geometry while the initial read has no data. */
export const KNOWLEDGE_ROWS_PLACEHOLDER: readonly KnowledgeRowView[] = [1, 2, 3].map((n) => ({
    id: `placeholder-${n}`,
    title: "-",
    lines: ["-"],
    badges: [{ label: "-", tone: "neutral" }],
    actions: [{ id: "action", label: "-", intent: "neutral" }],
}))

/** The pure list's resolved fields; callbacks travel separately from row data. */
interface KnowledgeRowListProps {
    readonly label: string
    readonly isLabelVisible?: boolean | undefined
    readonly action?: KnowledgeListView["section"]["action"]
    readonly footer?: string | undefined
    readonly rows: readonly KnowledgeRowView[]
    readonly isPending: boolean
    readonly isLoading?: boolean
    readonly emptyTitle: string
    readonly emptyBody?: string
    readonly onAction?: ((rowId: string, actionId: string, partId?: string) => void) | undefined
    readonly onConfirm?: ((rowId: string, actionId: string, partId?: string) => Promise<void>) | undefined
}

/** The section's resolved heading, supporting content and rendered row body. */
interface KnowledgeRowsSectionProps {
    readonly section: KnowledgeListView["section"]
    readonly isPending: boolean
    readonly isLoading?: boolean
    readonly isHeadingInCard?: boolean
    readonly before?: ReactNode
    readonly body: ReactNode
    readonly onAction?: KnowledgeRowListProps["onAction"]
    readonly onConfirm?: KnowledgeRowListProps["onConfirm"]
}

/** Draws the section around its already-rendered body, preserving local command feedback. */
export const KnowledgeRowsSection = (props: KnowledgeRowsSectionProps) => {
    const section = props.section
    const content = (
        <Stack gap="row">
            {section.error === undefined ? null : (
                <Alert tone="negative" title={section.failTitle} description={section.error} />
            )}
            {section.notice === undefined ? null : (
                <Text size="sm" live="polite">
                    {section.notice}
                </Text>
            )}
            {props.before}
            {props.body}
        </Stack>
    )
    if (props.isHeadingInCard === true) return content
    return (
        <Section
            id={section.id}
            title={section.title}
            {...(section.description === undefined ? {} : { description: section.description })}
            isLoading={props.isLoading ?? false}
            action={
                section.action === undefined ? undefined : (
                    <KnowledgeRowActions
                        items={[section.action]}
                        isLoading={props.isLoading ?? false}
                        isHeading
                        onAction={(id) => props.onAction?.(section.id, id)}
                        onConfirm={(id) => props.onConfirm?.(section.id, id)}
                    />
                )
            }
        >
            {content}
        </Section>
    )
}

/** Resolved list fields shared by a region's ready and loading collection. */
export const rowListPropsOf = (
    list: Pick<KnowledgeListView, "section" | "label" | "footer" | "isPending" | "slotLabels">,
) => ({
    label: list.label,
    isLabelVisible: true,
    action: list.section.action,
    footer: list.footer,
    isPending: list.isPending,
    emptyTitle: list.slotLabels.empty,
})

interface RowDetailProps {
    readonly row: KnowledgeRowView
    readonly isLoading: boolean
    readonly onAction: KnowledgeRowListProps["onAction"]
    readonly onConfirm: KnowledgeRowListProps["onConfirm"]
}

/** Retains overflow badges, live progress and separately decidable values in each row's detail. */
const RowDetail = (props: RowDetailProps) => {
    const row = props.row
    return (
        <Stack gap="row">
            {(row.badges ?? []).length <= 2 ? null : (
                <Cluster gap="inline">
                    {row.badges?.slice(2).map((badge) => (
                        <Badge key={badge.label} tone={badge.tone} isLoading={props.isLoading}>
                            {badge.label}
                        </Badge>
                    ))}
                </Cluster>
            )}
            {row.progress === undefined ? null : <KnowledgeProgressRow {...row.progress} />}
            <KnowledgeRowActions
                items={row.actions ?? []}
                isLoading={props.isLoading}
                onAction={(id) => props.onAction?.(row.id, id)}
                onConfirm={(id) => props.onConfirm?.(row.id, id)}
            />
            {(row.parts ?? []).map((part) => (
                <Cluster key={part.id} gap="row" align="center">
                    <Stack gap="identity" measure="full">
                        <Text isLoading={props.isLoading}>{part.title}</Text>
                        {(part.lines ?? []).map((line) => (
                            <Text key={line} size="xs" tone="muted" isLoading={props.isLoading}>
                                {line}
                            </Text>
                        ))}
                    </Stack>
                    <KnowledgeRowActions
                        items={part.actions ?? []}
                        isLoading={props.isLoading}
                        onAction={(id) => props.onAction?.(row.id, id, part.id)}
                        onConfirm={(id) => props.onConfirm?.(row.id, id, part.id)}
                    />
                </Cluster>
            ))}
        </Stack>
    )
}

/** The first two badges use the collection's published slots. */
const badgesOf = (row: KnowledgeRowView): Pick<ListRowData, "badges"> => {
    const [first, second] = row.badges ?? []
    if (first === undefined) return {}
    return second === undefined ? { badges: [first] } : { badges: [first, second] }
}

/** Converts atom-only rows into the grammar's native collection anatomy. */
const itemOf = (row: KnowledgeRowView, props: KnowledgeRowListProps): ListRowData => ({
    id: row.id,
    title: row.title,
    ...((row.lines ?? []).length === 0 ? {} : { description: (row.lines ?? []).join(" · ") }),
    ...badgesOf(row),
    ...(row.href === undefined ? {} : { action: { label: row.title, href: row.href } }),
    detail:
        row.progress === undefined &&
        (row.parts ?? []).length === 0 &&
        (row.actions ?? []).length === 0 &&
        (row.badges ?? []).length <= 2 ? undefined : (
            <RowDetail
                row={row}
                isLoading={props.isLoading ?? false}
                onAction={props.onAction}
                onConfirm={props.onConfirm}
            />
        ),
})

/** The native collection card; each read's SlotView remains in its connected block's pure twin. */
export const KnowledgeRowList = (props: KnowledgeRowListProps) => (
    <SurfaceCard
        kind="list"
        {...(props.isLabelVisible === true ? { label: props.label } : { ariaLabel: props.label })}
        isLoading={props.isLoading ?? false}
        items={props.rows.map((row) => itemOf(row, props))}
        empty={
            <EmptyNotice
                message={props.emptyTitle}
                {...(props.emptyBody === undefined ? {} : { description: props.emptyBody })}
            />
        }
        footer={props.footer}
        labelEnd={
            props.action === undefined || props.isLabelVisible !== true ? undefined : (
                <KnowledgeRowActions
                    items={[props.action]}
                    isHeading
                    isLoading={props.isLoading ?? false}
                    onAction={(id) => props.onAction?.("", id)}
                    onConfirm={(id) => props.onConfirm?.("", id)}
                />
            )
        }
    />
)
