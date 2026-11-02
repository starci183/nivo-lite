import type { ChatbotThreadViewData } from "@/modules/types"
import {
    Avatar,
    Badge,
    Cluster,
    Divider,
    Heading,
    IconButton,
    PaneSection,
    Stack,
    Text,
    MessageBubble,
    MessageStatus,
} from "@starci/grammar/common"
import { useEffect, useRef } from "react"
import type { RefObject } from "react"
import { ChatbotChips } from "@/components/branches/ChatbotChips"
import { ChatbotComposer } from "@/components/branches/ChatbotComposer"
import { ChatMessageFiles } from "@/components/leaves/ChatMessageFiles"
import { nivoIconSource } from "@/components/leaves/Icon"
import { HEAD_TEXT_CLASS_NAME, PHONE_ONLY_CLASS_NAME } from "./classNames"
/** The open conversation: its words, its entries and the composer. */
interface ChatbotThreadViewProps extends ChatbotThreadViewData {
    readonly onBack: () => void
    readonly onToggleInfo: () => void
    readonly onDraft: (draft: string) => void
    readonly onSend: () => void
}
/** The centre pane of the inbox: header, bubbles and the composer (active only while the signed-in member holds the conversation). */
export const ChatbotThreadView = (props: ChatbotThreadViewProps) => {
    const endRef = useRef<HTMLDivElement | null>(null)
    const lastId = props.entries.at(-1)?.id
    useEffect(() => {
        endRef.current?.scrollIntoView({ block: "end" })
    }, [lastId, props.name])
    if (!props.hasThread) {
        return (
            <PaneSection align="center" grow>
                {props.isResolving ? (
                    <MessageBubble isLoading hasAvatar />
                ) : (
                    <Text size="sm" tone="muted">
                        {props.pickBody}
                    </Text>
                )}
            </PaneSection>
        )
    }
    return (
        <>
            <PaneSection align="center">
                <Cluster gap="row" wrap={false}>
                    <div className={PHONE_ONLY_CLASS_NAME}>
                        <IconButton
                            intent="dismiss"
                            source={nivoIconSource("back", "leading")}
                            label={props.backLabel}
                            onPress={props.onBack}
                        />
                    </div>
                    <Avatar name={props.name} size="md" isDecorative />
                    <div className={HEAD_TEXT_CLASS_NAME}>
                        <Stack gap="identity">
                            <Heading level={2}>{props.name}</Heading>
                            <ChatbotChips channel={props.channel} chips={props.chips} />
                        </Stack>
                    </div>
                    <IconButton
                        intent="neutral"
                        source={nivoIconSource("sidebar", "leading")}
                        label={props.infoLabel}
                        isActive={props.isInfoOpen}
                        onPress={props.onToggleInfo}
                    />
                </Cluster>
            </PaneSection>
            <PaneSection scroll={{ label: props.name, role: "log", tone: "background" }}>
                {renderChatbotThreadViewEntries(props, endRef)}
            </PaneSection>
            <PaneSection>
                <ChatbotComposer
                    canReply={props.canReply}
                    lockedText={props.lockedText}
                    label={props.composerLabel}
                    placeholder={props.composerPlaceholder}
                    hint={props.composerHint}
                    sendLabel={props.sendLabel}
                    draft={props.draft}
                    notSentTitle={props.notSentTitle}
                    error={props.error}
                    isSending={props.isSending}
                    onDraft={props.onDraft}
                    onSend={props.onSend}
                />
            </PaneSection>
        </>
    )
}
/** Renders the ChatbotThreadView entries section. */
const renderChatbotThreadViewEntries = (
    props: Pick<ChatbotThreadViewProps, "entries">,
    endRef: RefObject<HTMLDivElement | null>,
) => (
    <Stack gap="row">
        {props.entries.map((entry) => {
            if (entry.kind !== "bubble") return <Divider key={entry.id} label={entry.text} />
            return (
                <MessageBubble
                    key={entry.id}
                    side={entry.side}
                    author={entry.author}
                    meta={entry.meta}
                    status={entry.aiMark === null ? undefined : <Badge tone="neutral">{entry.aiMark}</Badge>}
                    avatar={
                        entry.avatarName === null ? undefined : (
                            <Avatar name={entry.avatarName} size="sm" isDecorative />
                        )
                    }
                    footer={
                        entry.deliveryText === null && entry.files.length === 0 ? undefined : (
                            <>
                                {entry.files.length === 0 ? null : <ChatMessageFiles files={entry.files} />}
                                {entry.deliveryText === null || entry.deliveryKind === null ? null : (
                                    <MessageStatus
                                        kind="transport"
                                        state={entry.deliveryKind}
                                        label={entry.deliveryText}
                                    />
                                )}
                            </>
                        )
                    }
                    body={entry.text}
                />
            )
        })}
        <div ref={endRef} />
    </Stack>
)
