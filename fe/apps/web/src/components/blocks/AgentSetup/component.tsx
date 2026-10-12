import {
    Alert,
    Button,
    ChatBubble,
    ChatBubbleSkeletons,
    ChatWorkspace,
    Divider,
    EmptyNotice,
    FillViewport,
    Form,
    Heading,
    Spinner,
    SurfaceCard,
    Text,
    Textarea,
} from "@starci/grammar/common"
import { Fragment } from "react"
import type { ComponentProps } from "react"
import { SetupDraftCard } from "@/components/composites/SetupDraftCard"
import { SetupGatesCard } from "@/components/composites/SetupGatesCard"
import { SetupVersionsCard } from "@/components/composites/SetupVersionsCard"
import { SetupKnowledge } from "../SetupKnowledge"
import { SetupWriteCard } from "../SetupWriteCard"
import { CHAT_BAND, COMPOSER, COMPOSER_FIELD, COMPOSER_ROW, GRID, SENDING, SIDE, THREAD, WRITES } from "./classNames"

type WriteCardProps = ComponentProps<typeof SetupWriteCard>

/** One message of the chat with the confirm cards that sit under it. */
export interface AgentSetupMessage {
    readonly id: string
    readonly isOwner: boolean
    readonly author: string
    readonly body: string
    readonly cards: ReadonlyArray<WriteCardProps["write"]>
}

/** One revision of the chat: its messages and, when it was applied, the divider that closes it. */
export interface AgentSetupGroup {
    readonly id: string
    readonly messages: ReadonlyArray<AgentSetupMessage>
    readonly divider: string
}

/** Copy, state and commands of the setup screen. */
export interface AgentSetupBaseProps {
    readonly props: {
        readonly isLoading: boolean
        readonly chatTitle: string
        readonly chatPrivate: string
        readonly emptyTitle: string
        readonly emptyBody: string
        readonly groups: ReadonlyArray<AgentSetupGroup>
        readonly instance: WriteCardProps["instance"]
        readonly sendingLabel: string
        readonly isSending: boolean
        readonly composerLabel: string
        readonly text: string
        readonly sendLabel: string
        readonly failureTitle: string
        readonly failure: string
        readonly unmet: {
            readonly title: string
            readonly body: string
            readonly actionLabel: string
            readonly href: string
        } | null
        readonly draft: ComponentProps<typeof SetupDraftCard>
        readonly gates: Omit<
            ComponentProps<typeof SetupGatesCard>,
            "onEditText" | "onGate" | "onStartEdit" | "onStopEdit" | "onApply"
        >
        readonly knowledge: Omit<ComponentProps<typeof SetupKnowledge>, "onApplied">
        readonly versions: ComponentProps<typeof SetupVersionsCard>
    }
    readonly on: {
        readonly thread: (element: HTMLDivElement | null) => void
        readonly text: (value: string) => void
        readonly send: () => void
        readonly decide: WriteCardProps["onDecide"]
        readonly editText: (value: string) => void
        readonly gate: ComponentProps<typeof SetupGatesCard>["onGate"]
        readonly startEdit: ComponentProps<typeof SetupGatesCard>["onStartEdit"]
        readonly stopEdit: () => void
        readonly apply: () => void
        readonly open: (href: string) => void
        readonly refresh: () => void
    }
}

const Conversation = (props: AgentSetupBaseProps) => (
    <div ref={props.on.thread} className={THREAD} aria-live="polite">
        {props.props.isLoading ? <ChatBubbleSkeletons count={3} /> : null}
        {!props.props.isLoading && props.props.groups.every((group) => group.messages.length === 0) ? (
            <EmptyNotice message={props.props.emptyTitle} description={props.props.emptyBody} />
        ) : null}
        {props.props.groups.map((group) => (
            <Fragment key={group.id}>
                {group.messages.map((message) => (
                    <ChatBubble
                        key={message.id}
                        side={message.isOwner ? "outgoing" : "incoming"}
                        author={message.author}
                        footer={
                            message.cards.length > 0 ? (
                                <div className={WRITES}>
                                    {message.cards.map((card) => (
                                        <SetupWriteCard
                                            key={card.id}
                                            write={card}
                                            onDecide={props.on.decide}
                                            instance={props.props.instance}
                                        />
                                    ))}
                                </div>
                            ) : undefined
                        }
                    >
                        {message.body}
                    </ChatBubble>
                ))}
                {group.divider === "" ? null : <Divider label={group.divider} />}
            </Fragment>
        ))}
        {props.props.isSending ? (
            <div className={SENDING}>
                <Text size="sm" tone="muted" startContent={<Spinner size="sm" label={props.props.sendingLabel} />}>
                    {props.props.sendingLabel}
                </Text>
            </div>
        ) : null}
    </div>
)

const Composer = (props: AgentSetupBaseProps) => (
    <Form
        label={props.props.chatTitle}
        onSubmit={(_, event) => {
            event.preventDefault()
            props.on.send()
        }}
    >
        <div className={COMPOSER}>
            {props.props.failure === "" ? null : (
                <Alert title={props.props.failureTitle} description={props.props.failure} tone="negative" />
            )}
            <div className={COMPOSER_ROW}>
                <div className={COMPOSER_FIELD}>
                    <Textarea
                        id="setup-composer"
                        name="message"
                        label={props.props.composerLabel}
                        isLabelHidden
                        placeholder={props.props.composerLabel}
                        rows={2}
                        maxLength={4000}
                        value={props.props.text}
                        isSkeleton={props.props.isLoading}
                        isDisabled={props.props.isSending}
                        onValueChange={props.on.text}
                        onSubmitShortcut={props.on.send}
                    />
                </div>
                <Button
                    variant="primary"
                    isPending={props.props.isSending}
                    isDisabled={props.props.isLoading || props.props.text.trim().length === 0}
                    onPress={props.on.send}
                >
                    {props.props.sendLabel}
                </Button>
            </div>
        </div>
    </Form>
)

/** Draws the Setup tab: the private chat with NIVO on the left, the draft, the checklist, the knowledge and the versions on the right. */
export const AgentSetupBase = (props: AgentSetupBaseProps) => (
    <div className={GRID}>
        <FillViewport minHeight="md" bottomInset="page">
            <SurfaceCard ariaLabel={props.props.chatTitle} composition="joined" height="fill">
                <ChatWorkspace
                    label={props.props.chatTitle}
                    conversationLabel={props.props.chatTitle}
                    header={
                        <div className={CHAT_BAND}>
                            <Heading level={2}>{props.props.chatTitle}</Heading>
                            <Text size="xs" tone="muted">
                                {props.props.chatPrivate}
                            </Text>
                        </div>
                    }
                    conversation={<Conversation {...props} />}
                    composer={<Composer {...props} />}
                />
            </SurfaceCard>
        </FillViewport>
        <div className={SIDE}>
            {props.props.unmet === null ? null : (
                <Alert
                    title={props.props.unmet.title}
                    description={props.props.unmet.body}
                    tone="cautionary"
                    appearance="soft"
                    action={{
                        label: props.props.unmet.actionLabel,
                        onAction: () => props.on.open(props.props.unmet?.href ?? ""),
                    }}
                />
            )}
            <SetupDraftCard {...props.props.draft} />
            <SetupGatesCard
                {...props.props.gates}
                onEditText={props.on.editText}
                onGate={props.on.gate}
                onStartEdit={props.on.startEdit}
                onStopEdit={props.on.stopEdit}
                onApply={props.on.apply}
            />
            <SetupKnowledge {...props.props.knowledge} onApplied={props.on.refresh} />
            <SetupVersionsCard {...props.props.versions} />
        </div>
    </div>
)
