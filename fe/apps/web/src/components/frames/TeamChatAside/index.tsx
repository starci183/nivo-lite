import { EmptyNotice, PaneHeader, PaneSection, Section } from "@starci/grammar/common"
import type { SectionRow } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { TeamChatAsideSource, TeamChatAsideView } from "@/modules/types"

/** What the aside of the agent chat draws and asks of its owner. */
interface TeamChatAsideProps {
    readonly aside: TeamChatAsideView
    readonly onRetry: () => void
}

/** The rows of the list: each connection the agent answers from with its mark, then Second Brain. */
const rowsOf = (aside: TeamChatAsideView, sources: ReadonlyArray<TeamChatAsideSource>): ReadonlyArray<SectionRow> => [
    ...sources.map(
        (source): SectionRow => ({
            id: source.id,
            title: source.label,
            description: source.subline,
            leading:
                source.logo === undefined
                    ? { icon: nivoIconSource("link", "leading") }
                    : { avatar: { name: source.label, shape: "square", src: source.logo } },
        }),
    ),
    {
        id: "brain",
        title: aside.copy.brainTitle,
        description: aside.copy.brainLine,
        leading: { icon: nivoIconSource("brain", "leading") },
    },
]

/** The aside of an agent chat on the surface: what the agent answers from as a Grammar list, then the muted note. */
export const TeamChatAside = (props: TeamChatAsideProps) => (
    <>
        <PaneSection align="center">
            <PaneHeader title={props.aside.copy.title} />
        </PaneSection>
        <PaneSection scroll={{ label: props.aside.copy.title }} gap="section">
            <SlotView
                slot={props.aside.sources}
                placeholder={[]}
                labels={props.aside.labels}
                onRetry={props.onRetry}
                render={(sources, isLoading) => (
                    <Section
                        kind="list"
                        ariaLabel={props.aside.copy.title}
                        isLoading={isLoading}
                        caption={props.aside.copy.footnote}
                        items={rowsOf(props.aside, sources)}
                        empty={<EmptyNotice message={props.aside.copy.empty} />}
                    />
                )}
            />
        </PaneSection>
    </>
)
