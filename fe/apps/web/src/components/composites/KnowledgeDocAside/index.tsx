import { Button, DescriptionList, EmptyNotice, Link, Section, Text } from "@starci/grammar/common"
import type { ListRowData } from "@starci/grammar/common"
import type { DocFactView, DocIdeaView, DocIdeasView } from "@/modules/types"

/** What the facts of the opened item and the suggestions draw and call. */
interface KnowledgeDocAsideProps {
    readonly facts: ReadonlyArray<DocFactView>
    readonly ideas: DocIdeasView | null
    readonly nextReview: { readonly label: string; readonly href: string } | null
    readonly isLoading: boolean
    readonly onIdea: (ideaId: string, menuId: string) => void
    readonly onMore: () => void
}

/** One idea as a row: its topic and one line, the "add" command and the menu that sets it aside. */
const rowOf = (idea: DocIdeaView, ideas: DocIdeasView, onIdea: KnowledgeDocAsideProps["onIdea"]): ListRowData => ({
    id: idea.id,
    title: idea.title,
    ...(idea.line === "" ? {} : { description: idea.line }),
    action: { label: ideas.addLabel, href: idea.addHref, isPending: idea.isPending },
    actionPlacement: "end",
    menu: {
        label: ideas.menuLabel,
        entries: idea.menu.map((item) => ({
            id: item.id,
            label: item.label,
            onAction: () => onIdea(idea.id, item.id),
        })),
    },
})

/** An idea that was set aside, with the words that say how. */
type SkippedIdea = DocIdeaView & { readonly state: string }

/** The ideas that were set aside: each with the way to bring it back. */
const skippedRowOf = (
    idea: SkippedIdea,
    ideas: DocIdeasView,
    onIdea: KnowledgeDocAsideProps["onIdea"],
): ListRowData => ({
    id: idea.id,
    title: idea.title,
    description: idea.state,
    action: {
        label: idea.menu[0]?.label ?? ideas.addLabel,
        press: () => onIdea(idea.id, "restore"),
        isPending: idea.isPending,
    },
})

/**
 * The side pane body: the facts of the opened item as a compact term and value list, then the suggestions list, the documents worth adding,
 * each with one "add" command (the drawer opens preset on its topic) and a menu to set it aside or say it does not apply.
 */
export const KnowledgeDocAside = (props: KnowledgeDocAsideProps) => {
    const ideas = props.ideas
    return (
        <>
            {props.facts.length === 0 ? null : (
                <DescriptionList
                    density="compact"
                    isLoading={props.isLoading}
                    items={props.facts.map((fact) => ({ id: fact.id, term: fact.term, description: fact.text }))}
                />
            )}
            {props.nextReview === null ? null : (
                <Text size="sm" isLoading={props.isLoading}>
                    <Link href={props.nextReview.href} isDisabled={props.isLoading}>
                        {props.nextReview.label}
                    </Link>
                </Text>
            )}
            {ideas === null ? null : (
                <>
                    <Section
                        kind="list"
                        title={ideas.title}
                        headingLevel={2}
                        isLoading={props.isLoading}
                        items={ideas.open.map((idea) => rowOf(idea, ideas, props.onIdea))}
                        empty={<EmptyNotice message={ideas.emptyLabel} />}
                    />
                    {ideas.moreLabel === null ? null : (
                        <Button intent="neutral" size="sm" onPress={props.onMore}>
                            {ideas.moreLabel}
                        </Button>
                    )}
                    {ideas.skipped.length === 0 ? null : (
                        <Section
                            kind="list"
                            title={ideas.skippedTitle}
                            headingLevel={3}
                            items={ideas.skipped.map((idea) => skippedRowOf(idea, ideas, props.onIdea))}
                            empty={<EmptyNotice message={ideas.emptyLabel} />}
                        />
                    )}
                    <Text size="xs" tone="muted" isLoading={props.isLoading}>
                        {ideas.hint}
                    </Text>
                </>
            )}
        </>
    )
}
