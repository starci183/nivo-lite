import {
    Button,
    ChatBubble,
    Cluster,
    Divider,
    Drawer,
    Form,
    IconButton,
    Input,
    List,
    ListItem,
    Stack,
    Text,
} from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import { ASK_INPUT_CLASS, BUBBLE_CLASS, FOOT_CLASS, MESSAGES_CLASS, SUGGEST_CLASS } from "./classNames"

/** One button of a guide reply that opens a page. */
interface GuideBubbleLink {
    readonly id: string
    readonly label: string
}

/** One line of the conversation: the member question, or the guide answer with its steps and links. */
interface GuideBubbleMessage {
    readonly id: number
    readonly isUser: boolean
    readonly text: string
    readonly steps: ReadonlyArray<string>
    readonly links: ReadonlyArray<GuideBubbleLink>
    readonly note: string | null
}

/** The resolved words and conversation of the guide. */
interface GuideBubbleBaseProps {
    readonly props: {
        readonly isOpen: boolean
        /** The page is a messenger, the Second Brain or an agent detail with its own composer and panels: the floating button is not drawn there, so it never covers them. */
        readonly overComposer: boolean
        readonly openLabel: string
        readonly closeLabel: string
        readonly title: string
        readonly subtitle: string
        readonly greeting: string
        readonly stepsLabel: string
        readonly thinking: string
        readonly isThinking: boolean
        readonly messages: ReadonlyArray<GuideBubbleMessage>
        readonly suggestions: ReadonlyArray<string>
        readonly question: string
        readonly questionLabel: string
        readonly placeholder: string
        readonly sendLabel: string
        readonly restartLabel: string
    }
    readonly on: {
        readonly toggle: () => void
        readonly changeQuestion: (question: string) => void
        readonly send: () => void
        readonly ask: (question: string) => void
        readonly go: (messageId: number, linkId: string) => void
        readonly restart: () => void
    }
}

/** The guide: a floating button that opens a drawer chat which answers where to do things and opens the page it names. */
export const GuideBubbleBase = (props: GuideBubbleBaseProps) => (
    <>
        {props.props.overComposer ? null : (
            <div className={BUBBLE_CLASS}>
                <IconButton
                    source={nivoIconSource(props.props.isOpen ? "close" : "support", "leading")}
                    label={props.props.isOpen ? props.props.closeLabel : props.props.openLabel}
                    intent="neutral"
                    isFloating
                    onPress={props.on.toggle}
                />
            </div>
        )}
        <Drawer
            isOpen={props.props.isOpen}
            onOpenChange={(open) => {
                if (open !== props.props.isOpen) props.on.toggle()
            }}
            title={props.props.title}
            description={props.props.subtitle}
            closeLabel={props.props.closeLabel}
            placement="right"
        >
            <div className={MESSAGES_CLASS} aria-live="polite">
                <Stack gap="row">
                    <ChatBubble side="incoming">
                        <Text size="sm">{props.props.greeting}</Text>
                    </ChatBubble>
                    <GuideMessages {...props} />{" "}
                    {props.props.isThinking ? (
                        <ChatBubble side="incoming">
                            <Text size="sm" tone="muted">
                                {props.props.thinking}
                            </Text>
                        </ChatBubble>
                    ) : null}
                </Stack>
            </div>
            {props.props.messages.length > 0 ? null : (
                <div className={SUGGEST_CLASS}>
                    <Cluster gap="inline">
                        {props.props.suggestions.map((suggestion) => (
                            <Button
                                key={suggestion}
                                intent="neutral"
                                size="sm"
                                isDisabled={props.props.isThinking}
                                onPress={() => props.on.ask(suggestion)}
                            >
                                {suggestion}
                            </Button>
                        ))}
                    </Cluster>
                </div>
            )}
            <GuideComposer {...props} />{" "}
        </Drawer>
    </>
)

/** The question form and conversation restart action. */
const GuideComposer = (props: GuideBubbleBaseProps) => {
    return (
        <div className={FOOT_CLASS}>
            <Stack gap="inline">
                <Divider semantics="presentation" />
                <Form label={props.props.title} onSubmit={props.on.send} isPending={props.props.isThinking}>
                    <Cluster gap="inline" align="end" wrap={false}>
                        <div className={ASK_INPUT_CLASS}>
                            <Input
                                id="guide-question"
                                name="question"
                                label={props.props.questionLabel}
                                placeholder={props.props.placeholder}
                                value={props.props.question}
                                onValueChange={props.on.changeQuestion}
                            />
                        </div>
                        <Button
                            type="submit"
                            intent="commit"
                            isPending={props.props.isThinking}
                            isDisabled={props.props.question.trim() === ""}
                        >
                            {props.props.sendLabel}
                        </Button>
                    </Cluster>
                </Form>
                {props.props.messages.length === 0 ? null : (
                    <div>
                        <Button
                            intent="neutral"
                            size="sm"
                            isDisabled={props.props.isThinking}
                            onPress={props.on.restart}
                        >
                            {props.props.restartLabel}
                        </Button>
                    </div>
                )}
            </Stack>
        </div>
    )
}

/** Conversation replies with their ordered steps and navigation links. */
const GuideMessages = (props: GuideBubbleBaseProps) => {
    return (
        <>
            {props.props.messages.map((message) =>
                message.isUser ? (
                    <ChatBubble key={message.id} side="outgoing">
                        <Text size="sm">{message.text}</Text>
                    </ChatBubble>
                ) : (
                    <ChatBubble
                        key={message.id}
                        side="incoming"
                        footer={
                            message.note === null ? undefined : (
                                <Text size="xs" tone="muted">
                                    {message.note}
                                </Text>
                            )
                        }
                    >
                        <Stack gap="inline">
                            <Text size="sm">{message.text}</Text>
                            {message.steps.length === 0 ? null : (
                                <>
                                    <Text size="xs" tone="muted">
                                        {props.props.stepsLabel}
                                    </Text>
                                    <List as="ol" label={props.props.stepsLabel}>
                                        {message.steps.map((step, position) => (
                                            <ListItem key={step}>
                                                <Text size="sm">{`${position + 1}. ${step}`}</Text>
                                            </ListItem>
                                        ))}
                                    </List>
                                </>
                            )}
                            {message.links.length === 0 ? null : (
                                <Cluster gap="inline">
                                    {message.links.map((link) => (
                                        <Button
                                            key={link.id}
                                            intent="neutral"
                                            size="sm"
                                            onPress={() => props.on.go(message.id, link.id)}
                                        >
                                            {link.label}
                                        </Button>
                                    ))}
                                </Cluster>
                            )}
                        </Stack>
                    </ChatBubble>
                ),
            )}
        </>
    )
}
