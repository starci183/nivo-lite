import { Button, SurfaceCard, Text } from "@starci/grammar/common"
import {
    KNOWLEDGE_ROWS_PLACEHOLDER,
    KnowledgeRowList,
    KnowledgeRowsSection,
    rowListPropsOf,
} from "@/components/composites/KnowledgeRows"
import type { KnowledgeListView } from "@/modules/types"
import { SlotView } from "@/components/composites/SlotView"
import { COMPOSE_ACTIONS_CLASS_NAME, COMPOSE_CLASS_NAME, PUBLIC_DOCS_CLASS_NAME } from "./classNames"

/** The words and links of the card that starts a public document. */
interface ComposeView {
    readonly title: string
    readonly note: string
    readonly draftLabel: string
    readonly draftHref: string
    readonly writeLabel: string
    readonly writeHref: string
}

/** Copy and values the connected public documents supply. */
export interface PublicDocsBaseProps {
    readonly props: {
        /** Where a public document starts; null for a member who may only read. */
        readonly compose: ComposeView | null
        readonly list: KnowledgeListView
    }
    readonly on: {
        readonly retry: () => void
        readonly confirm: (rowId: string, actionId: string) => Promise<void>
    }
}

/**
 * Draws the documents customers may read: the card that starts one (NIVO drafts it from internal documents, or the owner writes it),
 * then the list with where each stands, who approved it and the internal documents it was written from.
 */
export const PublicDocsBase = (props: PublicDocsBaseProps) => {
    const list = props.props.list
    const compose = props.props.compose
    return (
        <div className={PUBLIC_DOCS_CLASS_NAME}>
            {compose === null ? null : (
                <SurfaceCard label={compose.title} headingLevel={2}>
                    <div className={COMPOSE_CLASS_NAME}>
                        <Text size="sm" tone="muted">
                            {compose.note}
                        </Text>
                        <div className={COMPOSE_ACTIONS_CLASS_NAME}>
                            <Button intent="commit" href={compose.draftHref}>
                                {compose.draftLabel}
                            </Button>
                            <Button intent="neutral" href={compose.writeHref}>
                                {compose.writeLabel}
                            </Button>
                        </div>
                    </div>
                </SurfaceCard>
            )}
            <KnowledgeRowsSection
                isHeadingInCard
                section={list.section}
                body={
                    <SlotView
                        slot={list.slot}
                        placeholder={KNOWLEDGE_ROWS_PLACEHOLDER}
                        labels={list.slotLabels}
                        onRetry={props.on.retry}
                        render={(rows, isLoading) => (
                            <KnowledgeRowList
                                {...rowListPropsOf(list)}
                                rows={rows}
                                isLoading={isLoading}
                                onConfirm={props.on.confirm}
                            />
                        )}
                    />
                }
            />
        </div>
    )
}
