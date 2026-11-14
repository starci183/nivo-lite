import type { ReactNode } from "react"
import {
    Avatar,
    Badge,
    Button,
    Cluster,
    Divider,
    Grid,
    Link,
    MessageBubble,
    MessageStatus,
    Stack,
    Text,
} from "@starci/grammar/common"
import type { MessageFile } from "../rows/conversation.types"
import type { ThreadViewEntry } from "../rows/conversation-view"
import { ThreadOrderCard, type ThreadOrderWords } from "./ThreadOrderCard"

/** The control that loads the messages before the first one drawn. */
export interface ConversationOlder {
    /** The words on the control. */
    readonly label: string
    /** Whether the older messages are loading now. */
    readonly isLoading: boolean
    /** Loads them. */
    readonly onLoad: () => void
}

/** The words of the controls on a message that failed to send. */
interface ConversationRetryWords {
    readonly retry: string
    readonly discard: string
}

/** The entries of the thread, resolved. */
interface ConversationThreadProps {
    /** The first read is in flight: waiting bubbles stand in for the messages. */
    readonly isLoading: boolean
    readonly entries: ReadonlyArray<ThreadViewEntry>
    readonly older: ConversationOlder | null
    readonly retryWords: ConversationRetryWords
    /** The labels of the order card under a message about an order. */
    readonly orderWords: ThreadOrderWords
    readonly onRetry: (id: string) => void
    readonly onDiscard: (id: string) => void
}

/** The footer of a message: how far it has travelled, and the controls of a send that failed. */
const footerOf = (
    entry: Extract<ThreadViewEntry, { kind: "message" }>,
    words: ConversationRetryWords,
    orderWords: ThreadOrderWords,
    onRetry: (id: string) => void,
    onDiscard: (id: string) => void,
): ReactNode => {
    if (entry.delivery === null && entry.files.length === 0 && entry.order === null) return undefined
    return (
        <Stack gap="inline">
            {filesOf(entry.files)}
            {entry.order === null ? null : <ThreadOrderCard order={entry.order} words={orderWords} />}
            {entry.delivery === null ? null : (
                <MessageStatus kind="transport" state={entry.delivery.state} label={entry.delivery.label} />
            )}
            {entry.canRetry ? (
                <Cluster gap="identity" wrap={false}>
                    <Button intent="neutral" size="sm" onPress={() => onRetry(entry.id)}>
                        {words.retry}
                    </Button>
                    <Button intent="neutral" size="sm" onPress={() => onDiscard(entry.id)}>
                        {words.discard}
                    </Button>
                </Cluster>
            ) : null}
        </Stack>
    )
}

/** One picture of a thread: it is shown and opens in full; a lone picture (a photo, a payment QR) keeps its own shape, an album frame is a square. */
interface PictureLinkProps {
    readonly file: MessageFile
    /** Whether the picture is a frame of an album (a square) rather than a lone picture. */
    readonly isAlbum: boolean
}

/** One picture of a thread as a destination. */
const PictureLink = (props: PictureLinkProps): ReactNode => (
    <Link
        href={props.file.url}
        kind="external"
        label={props.file.name === "" ? props.file.url : props.file.name}
        media={{
            src: props.file.url,
            alt: props.file.name,
            aspect: props.isAlbum ? "square" : "auto",
            fit: props.isAlbum ? "cover" : "contain",
        }}
    />
)

/** The files under a bubble: one picture whole, two or more as a two-column album, any other file as a link. */
const filesOf = (files: ReadonlyArray<MessageFile>): ReactNode => {
    if (files.length === 0) return null
    const pictures = files.filter((file) => file.contentType.startsWith("image/"))
    const others = files.filter((file) => !file.contentType.startsWith("image/"))
    const isAlbum = pictures.length > 1
    return (
        <Stack gap="inline">
            {isAlbum ? (
                <Grid kind="cards" columns={2}>
                    {pictures.map((file) => (
                        <PictureLink key={file.id} file={file} isAlbum />
                    ))}
                </Grid>
            ) : (
                pictures.map((file) => <PictureLink key={file.id} file={file} isAlbum={false} />)
            )}
            {others.map((file) => (
                <Link key={file.id} href={file.url} kind="external">
                    {file.name === "" ? file.url : file.name}
                </Link>
            ))}
        </Stack>
    )
}

/** One entry: a day divider, a line of the system, or a bubble on the side of whoever wrote it. */
const entryView = (
    entry: ThreadViewEntry,
    words: ConversationRetryWords,
    orderWords: ThreadOrderWords,
    onRetry: (id: string) => void,
    onDiscard: (id: string) => void,
): ReactNode => {
    if (entry.kind === "day") return <Divider key={entry.id} label={entry.label} />
    if (entry.kind === "notice") {
        return (
            <Cluster key={entry.id} gap="inline" justify="center">
                <Text size="xs" tone="muted">
                    {entry.text}
                </Text>
            </Cluster>
        )
    }
    return (
        <MessageBubble
            key={entry.id}
            side={entry.side}
            {...(entry.side === "outgoing" ? { tone: entry.tone } : {})}
            body={entry.text}
            {...(entry.author === "" ? {} : { author: entry.author })}
            {...(entry.meta === "" ? {} : { meta: entry.meta })}
            {...(entry.mark === "" ? {} : { status: <Badge tone="neutral">{entry.mark}</Badge> })}
            {...(entry.hasAvatar ? { avatar: <Avatar name={entry.author} size="sm" isDecorative /> } : {})}
            footer={footerOf(entry, words, orderWords, onRetry, onDiscard)}
        />
    )
}

/** The content of the thread band: the older-messages control, then day dividers, notices and bubbles in order. */
export const ConversationThread = (props: ConversationThreadProps): ReactNode =>
    props.isLoading ? (
        <MessageBubble isLoading hasAvatar />
    ) : (
        <Stack gap="row">
            {props.older === null ? null : (
                <Cluster gap="inline" justify="center">
                    <Button intent="neutral" size="sm" isPending={props.older.isLoading} onPress={props.older.onLoad}>
                        {props.older.label}
                    </Button>
                </Cluster>
            )}
            {props.entries.map((entry) =>
                entryView(entry, props.retryWords, props.orderWords, props.onRetry, props.onDiscard),
            )}
        </Stack>
    )
