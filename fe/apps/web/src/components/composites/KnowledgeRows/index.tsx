import type { ReactNode } from "react"
import { Alert, Region, SectionHeader, Text } from "@starci/grammar/common"
import { HEAD_CLASS_NAME, SECTION_CLASS_NAME, TITLE_CLASS_NAME } from "./classNames"
import { ActionList, Rows } from "./rows"
import type { RowActionView, RowsProps } from "./rows"

export type { KnowledgeRowView, RowActionView, RowPartView } from "./rows"

/** The heading of a section and how its last command went. */
interface SectionView {
    readonly id: string
    readonly title: string
    readonly description?: string
    readonly failTitle: string
    readonly error?: string
    /** How the last command went, read out politely. */
    readonly notice?: string
    /** A control beside the heading. */
    readonly action?: RowActionView
}

/** What a list of the knowledge and brain pages draws. */
export interface KnowledgeRowsProps extends RowsProps {
    /** The heading around the list; the bare list when absent. */
    readonly section?: SectionView
    /** Content drawn between the heading and the list. */
    readonly before?: ReactNode
    /** Content drawn under the list. */
    readonly after?: ReactNode
}

/** A list of rows of the knowledge and brain pages, under a named heading with its failure alert and polite notice when a section is given. */
export const KnowledgeRows = (props: KnowledgeRowsProps) => {
    const section = props.section
    if (section === undefined) return <Rows {...props} />
    return (
        <Region labelledBy={section.id} className={SECTION_CLASS_NAME}>
            <div className={HEAD_CLASS_NAME}>
                <div className={TITLE_CLASS_NAME}>
                    <SectionHeader id={section.id} level={2} title={section.title} description={section.description} />
                </div>
                {section.action === undefined ? null : (
                    <ActionList items={[section.action]} isPending={props.isPending} />
                )}
            </div>
            {section.error === undefined ? null : (
                <Alert tone="negative" title={section.failTitle} description={section.error} />
            )}
            {section.notice === undefined ? null : (
                <Text size="sm" live="polite">
                    {section.notice}
                </Text>
            )}
            {props.before}
            <Rows {...props} />
            {props.after}
        </Region>
    )
}
