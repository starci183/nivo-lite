import type { ReactElement, ReactNode } from "react"
import type { MessageStatusProps } from "@starci/grammar/common"
import { Button, Divider, EmptyNotice, Stack, Text, MessageBubble } from "@starci/grammar/common"
import { OfficeAvatar } from "@/components/branches/OfficeAvatar"
import { OfficeMessageRow } from "@/components/branches/OfficeMessageRow"
import { OfficeOutboxBubble } from "@/components/branches/OfficeOutboxBubble"
import type { OfficeThreadProps as OfficeThreadDataProps, OfficeMessageStatusView } from "@/modules/types"
import { TYPING_CLASS_NAME } from "./classNames"

/** A thread item that sits in an inset band: every kind but the day divider. */
type OfficeThreadBandItem = Exclude<OfficeThreadDataProps["props"]["items"][number], { readonly kind: "day" }>

/** A day divider, or a run of entries by one author: a message continues the run before it, anything else starts one. */
type OfficeThreadGroup =
    | { readonly kind: "day"; readonly key: string; readonly label: string }
    | { readonly kind: "run"; readonly key: string; readonly items: ReadonlyArray<OfficeThreadBandItem> }

/** Presentation-only slots are local to this thread; shared Office data contains no React nodes. */
interface OfficeThreadProps {
    readonly props: Pick<
        OfficeThreadDataProps["props"],
        | "isLoading"
        | "copiedKey"
        | "items"
        | "outbox"
        | "typing"
        | "hasEarlier"
        | "isLoadingEarlier"
        | "copy"
        | "receipts"
    >
    readonly on: Pick<OfficeThreadDataProps["on"], "loadEarlier" | "reply" | "copy">
    readonly cardNodes: ReadonlyMap<string, ReactElement>
    readonly readingCard: ReactNode
}

/** Folds the thread's items into day dividers and runs of continued messages. */
const groupsOf = (items: OfficeThreadDataProps["props"]["items"]): ReadonlyArray<OfficeThreadGroup> =>
    items.reduce<ReadonlyArray<OfficeThreadGroup>>((groups, item) => {
        if (item.kind === "day") return [...groups, { kind: "day", key: item.key, label: item.label }]
        const last = groups.at(-1)
        if (item.kind === "message" && item.isContinuation && last?.kind === "run") {
            return [...groups.slice(0, -1), { ...last, items: [...last.items, item] }]
        }
        return [...groups, { kind: "run", key: item.key, items: [item] }]
    }, [])

/**
 * The thread's message column, inside the scroll band of its pane: the earlier button, day dividers, lines, approval,
 * exception and command cards, the unsent lines, the line being read and the typing row.
 */
export const OfficeThread = (props: OfficeThreadProps) => {
    const view = props.props
    const { copy } = view
    return (
        <Stack gap="row" measure="reading">
            {view.isLoading ? <MessageBubble isLoading hasAvatar /> : null}
            {!view.isLoading && view.hasEarlier ? (
                <Button intent="neutral" size="sm" isPending={view.isLoadingEarlier} onPress={props.on.loadEarlier}>
                    {copy.thread.loadEarlier}
                </Button>
            ) : null}
            {!view.isLoading && view.items.length === 0 ? (
                <EmptyNotice message={copy.thread.emptyMessage} description={copy.thread.emptyMessageHint} />
            ) : null}
            {renderOfficeThreadItems(props)}
            {view.outbox.length === 0 ? null : (
                <Stack gap="identity">
                    {view.outbox.map((line) => (
                        <OfficeOutboxBubble key={line.id} line={line} copy={copy.outbox} />
                    ))}
                </Stack>
            )}
            {props.readingCard}
            <div className={TYPING_CLASS_NAME}>
                {view.typing === "" ? null : (
                    <Text size="sm" tone="muted" live="polite">
                        {view.typing}
                    </Text>
                )}
            </div>
        </Stack>
    )
}

/** Renders settled thread items: a day divider spans the column, every other item sits in an inset band. */
const renderOfficeThreadItems = (props: OfficeThreadProps) =>
    props.props.isLoading
        ? null
        : groupsOf(props.props.items).map((group) =>
              group.kind === "day" ? (
                  <Divider key={group.key} label={group.label} />
              ) : (
                  <Stack key={group.key} gap="identity">
                      {group.items.map((item) => renderOfficeThreadItem(item, props))}
                  </Stack>
              ),
          )

/** Renders one settled, non-day thread item or its decision card. */
const renderOfficeThreadItem = (item: OfficeThreadBandItem, props: OfficeThreadProps) => {
    if (item.kind !== "message") return props.cardNodes.get(item.key)
    const { props: view, on } = props
    const { copy } = view
    const avatar = item.avatar === null ? null : <OfficeAvatar avatar={item.avatar} size="sm" />
    const labels = view.receipts.find((entry) => entry.key === item.key)
    const receipt = item.status === null ? undefined : officeMessageReceiptOf(item.status, labels)
    return (
        <OfficeMessageRow
            key={item.key}
            message={item}
            avatar={avatar}
            copy={copy.message}
            {...(receipt === undefined ? {} : { receipt })}
            isCopied={view.copiedKey === item.key}
            onReply={on.reply}
            onCopy={on.copy}
        />
    )
}

/** The receipt that belongs under an Office message, rendered by the native footer status owner. */
type OfficeMessageReceiptProps = Extract<MessageStatusProps, { readonly kind: "receipt" }>

/** The native receipt shows the same first three readers as the approved Office status. */
/** Preserves the authority state, reader order, avatar fallbacks and both localized overflow counts. */
const officeMessageReceiptOf = (
    status: OfficeMessageStatusView,
    labels: OfficeThreadDataProps["props"]["receipts"][number] | undefined,
): OfficeMessageReceiptProps => {
    if (status.kind !== "seen") return { kind: "receipt", state: status.kind, label: status.label }
    return {
        kind: "receipt",
        state: "seen",
        label: status.label,
        ...((status.readers.length === 0 && status.moreReaders === 0) || labels === undefined
            ? {}
            : {
                  readers: {
                      items: status.readers.map((reader) => ({
                          id: reader.id,
                          name: reader.name,
                          ...(reader.avatarUrl === null ? {} : { src: reader.avatarUrl }),
                      })),
                      overflowLabel: labels.overflowLabel,
                      ...(labels.moreLabel !== null ? { moreLabel: labels.moreLabel } : {}),
                  },
              }),
    }
}
