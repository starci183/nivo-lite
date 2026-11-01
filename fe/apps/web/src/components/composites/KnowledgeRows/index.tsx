import type { ReactNode } from "react"
import { Alert, Region, SectionHeader, Text } from "@starci/grammar/common"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { HEAD_CLASS_NAME, SECTION_CLASS_NAME, TITLE_CLASS_NAME } from "./classNames"
import { ActionList } from "./component"
import type { KnowledgeRowView, RowActionView } from "./component"

export { KnowledgeRowList } from "./component"
export type { KnowledgeRowListProps, KnowledgeRowView, RowActionView, RowPartView } from "./component"

/** Rows of the same shape as a ready list, drawn as geometry while a list is read: the loading tree of a block's list is the ready tree. */
export const KNOWLEDGE_ROWS_PLACEHOLDER: ReadonlyArray<KnowledgeRowView> = [1, 2, 3].map((n) => ({
    id: `placeholder-${n}`,
    title: "-",
    lines: ["-"],
    badges: [{ label: "-", tone: "neutral" as const }],
    actions: [{ id: "action", label: "-", intent: "neutral" as const }],
}))

/** The heading of a section and how its last command went. */
export interface SectionView {
    readonly id: string
    readonly title: string
    readonly description?: string
    readonly failTitle: string
    readonly error?: string | undefined
    /** How the last command went, read out politely. */
    readonly notice?: string | undefined
    /** A control beside the heading. */
    readonly action?: RowActionView | undefined
}

/** What a block hands its list: the heading, the rows as one slot with the copy of its status, and whether a command is running. */
export interface KnowledgeListView {
    readonly section: SectionView
    readonly label: string
    readonly isPending: boolean
    readonly slot: DataSlot<ReadonlyArray<KnowledgeRowView>>
    readonly slotLabels: SlotLabels
    /** The note under the rows, in the card's footer. */
    readonly footer?: string | undefined
}

/** What the frame of a list draws: the section around the rows, and the region's own status view in the rows' place. */
interface KnowledgeRowsSectionProps {
    readonly section: SectionView
    readonly isPending: boolean
    /** The heading is a placeholder of the same shape. */
    readonly isSkeleton?: boolean
    /** The heading belongs to the card of the rows (its label, with the action at the end of the label row): the section draws none. */
    readonly isHeadingInCard?: boolean
    /** Content drawn between the heading and the list. */
    readonly before?: ReactNode
    /** The list, or the status view of the slot that reads it. */
    readonly children: ReactNode
}

/** The frame of a list under a named heading with its failure alert and polite notice; the region's slot renders inside it. */
export const KnowledgeRowsSection = (props: KnowledgeRowsSectionProps) => {
    const section = props.section
    const named = props.isHeadingInCard === true ? { label: section.title } : { labelledBy: section.id }
    return (
        <Region {...named} className={SECTION_CLASS_NAME}>
            {props.isHeadingInCard === true ? null : (
                <div className={HEAD_CLASS_NAME}>
                    <div className={TITLE_CLASS_NAME}>
                        <SectionHeader
                            id={section.id}
                            level={2}
                            title={section.title}
                            description={section.description}
                            isSkeleton={props.isSkeleton ?? false}
                        />
                    </div>
                    {section.action === undefined ? null : (
                        <ActionList items={[section.action]} isPending={props.isPending} />
                    )}
                </div>
            )}
            {section.error === undefined ? null : (
                <Alert tone="negative" title={section.failTitle} description={section.error} />
            )}
            {section.notice === undefined ? null : (
                <Text size="sm" live="polite">
                    {section.notice}
                </Text>
            )}
            {props.before}
            {props.children}
        </Region>
    )
}

/** The props of the card of a list: its label is the heading outside the shell, its action hugs the end of the label row and its note is the footer. */
export const rowListPropsOf = (list: KnowledgeListView) => ({
    label: list.label,
    isLabelVisible: true,
    action: list.section.action,
    footer: list.footer,
    isPending: list.isPending,
})
