import type { ReactNode } from "react"
import {
    Avatar,
    Button,
    Cluster,
    Drawer,
    Kbd,
    Pane,
    PaneGrid,
    PaneSection,
    SearchField,
    Stack,
    Text,
} from "@starci/grammar/common"
import { ChatMessageBubble } from "@/components/composites/ChatMessageBubble"
import { onGuideKeys } from "@/hooks/guide"
import { COLUMN_CLASS, SHEET_CLASS } from "./classNames"
import { GuideRowsCard } from "./groups"
import { GuideMessages } from "./messages"
import type { GuideBubbleMessage, GuideGroupView, GuideRowView } from "./types"

/** The resolved words and state of the drawer. */
interface GuideDrawerBaseProps {
    readonly props: {
        readonly isOpen: boolean
        readonly title: string
        readonly subtitle: string
        readonly closeLabel: string
        readonly imageSrc: string
        /** The chord that opens the guide, drawn small in the head. */
        readonly shortcutKeys: ReadonlyArray<string>
        /** "You are on X. N things to do here:", the label of the list and the things. */
        readonly here: { readonly text: string; readonly title: string; readonly todos: ReadonlyArray<GuideRowView> }
        /** The suggestion pills: words only. */
        readonly chips: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly query: string
        readonly questionLabel: string
        readonly placeholder: string
        readonly clearLabel: string
        readonly isSearching: boolean
        readonly groups: ReadonlyArray<GuideGroupView>
        /** Set only when a search found nothing: the words and the label of the one action that asks the model. */
        readonly noResults: { readonly text: string; readonly askLabel: string } | null
        readonly messages: ReadonlyArray<GuideBubbleMessage>
        readonly isThinking: boolean
        readonly thinking: string
        readonly stepsLabel: string
        readonly emptyLabel: string
        readonly restartLabel: string
    }
    readonly on: {
        readonly toggle: () => void
        readonly changeQuery: (query: string) => void
        readonly submit: () => void
        readonly open: (id: string) => void
        readonly chip: (id: string) => void
        readonly ask: () => void
        readonly go: (messageId: number, linkId: string) => void
        readonly restart: () => void
    }
}

/** The words the head description draws. */
interface HeadDescriptionProps {
    readonly props: Pick<GuideDrawerBaseProps["props"], "subtitle" | "shortcutKeys">
}

/** The head's line under the title: the subtitle, and the small chord that opens the guide, on the same line. */
const HeadDescription = (props: HeadDescriptionProps) => (
    <>
        <span>{props.props.subtitle}</span> <Kbd keys={[...props.props.shortcutKeys]} />
    </>
)

/** The drawer props with the avatar the runs share. */
interface GuideRunProps extends GuideDrawerBaseProps {
    readonly avatar: ReactNode
}

/** What NIVO says first: where you are, and the things to do there as a card of rows. */
const HereRun = (props: GuideRunProps) => {
    const { here } = props.props
    const hasTodos = here.todos.length > 0
    return (
        <>
            <ChatMessageBubble
                side="incoming"
                avatar={props.avatar}
                body={<Text size="sm">{here.text}</Text>}
            />
            {hasTodos ? (
                <GuideRowsCard
                    props={{ label: null, name: here.title, rows: here.todos }}
                    on={{ open: props.on.open }}
                />
            ) : null}
        </>
    )
}

/** The query echoed as the reader's own bubble, then NIVO's cards of results, or the one way on when it found nothing. */
const FoundRun = (props: GuideRunProps) => (
    <>
        <ChatMessageBubble side="outgoing" body={<Text size="sm">{props.props.query.trim()}</Text>} />
        {props.props.noResults === null ? (
            props.props.groups.map((group) => (
                <GuideRowsCard
                    key={group.id}
                    props={{ label: group.title, name: group.title, rows: group.rows }}
                    on={{ open: props.on.open }}
                />
            ))
        ) : (
            <>
                <ChatMessageBubble
                    side="incoming"
                    avatar={props.avatar}
                    body={<Text size="sm">{props.props.noResults.text}</Text>}
                />
                <div className={COLUMN_CLASS}>
                    <Button intent="neutral" size="sm" isDisabled={props.props.isThinking} onPress={props.on.ask}>
                        {props.props.noResults.askLabel}
                    </Button>
                </div>
            </>
        )}
    </>
)

/** The thread in the pink well: blocks 12 apart, none touching. */
const Thread = (props: GuideDrawerBaseProps) => {
    const avatar = <Avatar name={props.props.title} src={props.props.imageSrc} size="sm" isDecorative />
    const showChips = props.props.messages.length === 0
    return (
        <Stack gap="row">
            <HereRun {...props} avatar={avatar} />
            {showChips && props.props.chips.length > 0 ? (
                <div className={COLUMN_CLASS}>
                    <Cluster gap="inline">
                        {props.props.chips.map((chip) => (
                            <Button key={chip.id} intent="neutral" size="sm" onPress={() => props.on.chip(chip.id)}>
                                {chip.label}
                            </Button>
                        ))}
                    </Cluster>
                </div>
            ) : null}
            {props.props.isSearching ? <FoundRun {...props} avatar={avatar} /> : null}
            <GuideMessages
                props={{
                    messages: props.props.messages,
                    stepsLabel: props.props.stepsLabel,
                    emptyLabel: props.props.emptyLabel,
                    avatar,
                }}
                on={{ go: props.on.go }}
            />
            {props.props.isThinking ? (
                <ChatMessageBubble
                    side="incoming"
                    avatar={avatar}
                    body={
                        <Text size="sm" tone="muted">
                            {props.props.thinking}
                        </Text>
                    }
                />
            ) : null}
        </Stack>
    )
}

/** The composer, pinned under the well like the chat composer: a separator, then the search field. */
const Composer = (props: GuideDrawerBaseProps) => (
    <PaneSection as="footer" gap="row">
        <SearchField
            id="guide-question"
            label={props.props.questionLabel}
            isLabelHidden
            placeholder={props.props.placeholder}
            clearLabel={props.props.clearLabel}
            value={props.props.query}
            onValueChange={props.on.changeQuery}
            onSubmit={props.on.submit}
            autoFocus
        />
        {props.props.messages.length === 0 ? null : (
            <div>
                <Button intent="neutral" size="sm" isDisabled={props.props.isThinking} onPress={props.on.restart}>
                    {props.props.restartLabel}
                </Button>
            </div>
        )}
    </PaneSection>
)

/**
 * The guide drawer, a chat-style navigator. The head band is the drawer's own (the NIVO face, the title, the subtitle with the small
 * chord, close); under a separator the thread stands in the pink well, and the search field is pinned at the foot in a composer band.
 */
export const GuideDrawerBase = (props: GuideDrawerBaseProps) => (
    <Drawer
        isOpen={props.props.isOpen}
        onOpenChange={(open) => {
            if (open !== props.props.isOpen) props.on.toggle()
        }}
        title={props.props.title}
        description={<HeadDescription props={props.props} />}
        leading={<Avatar name={props.props.title} src={props.props.imageSrc} size="md" isDecorative />}
        closeLabel={props.props.closeLabel}
        placement="right"
        width="wide"
        bodyInset="none"
    >
        <div className={SHEET_CLASS} onKeyDown={onGuideKeys}>
            <PaneGrid label={props.props.title} areas={["guide"]}>
                <Pane area="guide" content="chat" footer={<Composer {...props} />}>
                    <PaneSection scroll={{ label: props.props.title, role: "log", align: "end" }} gap="row">
                        <Thread {...props} />
                    </PaneSection>
                </Pane>
            </PaneGrid>
        </div>
    </Drawer>
)
