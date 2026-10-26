import { CheckboxGroup, SearchField, SegmentedControl, Text } from "@starci/grammar/common"

/** One chat of the picker. */
type TelegramChatOption = {
    readonly value: string
    readonly label: string
    /** Its kind, and its unread count when it has one. */
    readonly description: string
    /** The picker is full and this chat is not ticked. */
    readonly isDisabled: boolean
}

/** What the chat step of the personal Telegram wizard draws and reports. */
type TelegramUserChatsProps = {
    readonly options: ReadonlyArray<TelegramChatOption>
    readonly value: ReadonlyArray<string>
    readonly query: string
    readonly sinceDays: string
    readonly isDisabled: boolean
    readonly text: Readonly<
        Record<"hint" | "search" | "placeholder" | "count" | "empty" | "label" | "since" | "since7" | "since30", string>
    >
    readonly onQuery: (value: string) => void
    readonly onChange: (ids: ReadonlyArray<string>) => void
    readonly onSince: (value: string) => void
}

/** Step "chats": a searchable list of recent chats with a tick each, then how far back the first sync reads. */
export const TelegramUserChats = (props: TelegramUserChatsProps) => (
    <>
        <Text size="sm" tone="muted">
            {props.text.hint}
        </Text>
        <SearchField
            label={props.text.search}
            placeholder={props.text.placeholder}
            isDisabled={props.isDisabled}
            value={props.query}
            onValueChange={props.onQuery}
            onClear={() => props.onQuery("")}
        />
        <Text size="sm" live="polite">
            {props.text.count}
        </Text>
        {props.options.length === 0 ? (
            <Text size="sm" tone="muted">
                {props.text.empty}
            </Text>
        ) : (
            <CheckboxGroup
                label={props.text.label}
                isLabelHidden
                isDisabled={props.isDisabled}
                options={props.options}
                value={[...props.value]}
                onValueChange={(ids) => props.onChange(ids)}
            />
        )}
        <SegmentedControl
            label={props.text.since}
            value={props.sinceDays}
            options={[
                { value: "7", label: props.text.since7 },
                { value: "30", label: props.text.since30 },
            ]}
            onValueChange={props.onSince}
        />
    </>
)
