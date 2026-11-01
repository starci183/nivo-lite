import { Button, ChatBubbleSkeletons, Divider, EmptyNotice, Stack, Text } from "@starci/grammar/common"
import { OfficeApprovalCard } from "@/components/branches/OfficeApprovalCard"
import { OfficeAvatar } from "@/components/branches/OfficeAvatar"
import { OfficeCommandCard } from "@/components/branches/OfficeCommandCard"
import { OfficeExceptionCard } from "@/components/branches/OfficeExceptionCard"
import { OfficeExceptionForm } from "@/components/branches/OfficeExceptionForm"
import { OfficeMessageStatus } from "@/components/branches/OfficeMessageStatus"
import { OfficeMessageRow } from "@/components/branches/OfficeMessageRow"
import { OfficeOutboxBubble } from "@/components/branches/OfficeOutboxBubble"
import { OfficeResultCard } from "@/components/branches/OfficeResultCard"
import type { OfficeCommandView, OfficeThreadProps } from "@/modules/types"
import { TYPING_CLASS_NAME } from "./classNames"

/** A thread item that sits in an inset band: every kind but the day divider. */
type OfficeThreadBandItem = Exclude<OfficeThreadProps["props"]["items"][number], { readonly kind: "day" }>

/** A day divider, or a run of entries by one author: a message continues the run before it, anything else starts one. */
type OfficeThreadGroup =
    | { readonly kind: "day"; readonly key: string; readonly label: string }
    | { readonly kind: "run"; readonly key: string; readonly items: ReadonlyArray<OfficeThreadBandItem> }

/** Folds the thread's items into day dividers and runs of continued messages. */
const groupsOf = (items: OfficeThreadProps["props"]["items"]): ReadonlyArray<OfficeThreadGroup> =>
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
    const { text } = view
    return (
        <Stack gap="row" measure="reading">
            {view.isSkeleton ? <ChatBubbleSkeletons count={3} hasAvatar /> : null}
            {!view.isSkeleton && view.hasEarlier ? (
                <Button intent="neutral" size="sm" isPending={view.isLoadingEarlier} onPress={props.on.loadEarlier}>
                    {text("loadEarlier")}
                </Button>
            ) : null}
            {!view.isSkeleton && view.items.length === 0 ? (
                <EmptyNotice message={text("emptyMessage")} description={text("emptyMessageHint")} />
            ) : null}
            {renderOfficeThreadItems(props)}
            {view.outbox.length === 0 ? null : (
                <Stack gap="identity">
                    {view.outbox.map((line) => (
                        <OfficeOutboxBubble key={line.id} line={line} text={text} />
                    ))}
                </Stack>
            )}
            {view.reading === null ? null : renderOfficeThreadCommand(null, view.reading, props)}
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
    props.props.isSkeleton
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
    const { props: view, on } = props
    const { text } = view
    const avatar = item.avatar === null ? null : <OfficeAvatar avatar={item.avatar} size="sm" />
    if (item.kind === "approval") {
        return (
            <OfficeApprovalCard
                key={item.key}
                approval={item}
                avatar={avatar}
                text={text}
                draft={view.draftOf(item.key)}
                onEdit={on.editCard}
                isBusy={view.busyId === item.id}
                onDecide={on.decideApproval}
            />
        )
    }
    if (item.kind === "exception") {
        const form = (
            <OfficeExceptionForm
                item={item}
                text={text}
                draft={view.draftOf(item.key)}
                onEdit={on.editCard}
                isBusy={view.busyId === item.id}
                onDecide={on.decideWork}
            />
        )
        return <OfficeExceptionCard key={item.key} item={item} avatar={avatar} text={text} form={form} />
    }
    if (item.kind === "command") return renderOfficeThreadCommand(item, item, props)
    if (item.kind === "card") {
        return (
            <OfficeResultCard
                key={item.key}
                card={item}
                avatar={avatar}
                text={text}
                draft={view.draftOf(item.key)}
                onEdit={on.editCard}
                isBusy={item.refId !== null && view.busyId === item.refId}
                onDecide={on.decideCard}
            />
        )
    }
    const status = item.status === null ? null : <OfficeMessageStatus status={item.status} text={text} />
    return (
        <OfficeMessageRow
            key={item.key}
            message={item}
            avatar={avatar}
            text={text}
            status={status}
            isCopied={view.copiedKey === item.key}
            onReply={on.reply}
            onCopy={on.copy}
        />
    )
}

/** Renders a command card: the settled command item, or the one being prepared while NIVO reads the line (no command yet). */
const renderOfficeThreadCommand = (
    command: OfficeCommandView | null,
    from: Pick<NonNullable<OfficeThreadProps["props"]["reading"]>, "ask" | "agent" | "avatar">,
    props: OfficeThreadProps,
) => (
    <OfficeCommandCard
        key={command?.key}
        command={command}
        ask={from.ask}
        agent={from.agent}
        avatar={<OfficeAvatar avatar={from.avatar} size="sm" />}
        text={props.props.text}
        isBusy={command !== null && props.props.busyId === command.id}
        onSend={props.on.sendCommand}
        onCancel={props.on.cancelCommand}
    />
)
