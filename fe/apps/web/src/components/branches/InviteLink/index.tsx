import { Input, Text, Stack } from "@starci/grammar/common"

/** What an issued invitation link shows. */
type InviteLinkProps = {
    readonly id: string
    readonly label: string
    readonly link: string
    readonly copyLabel: string
    readonly copiedLabel: string
    /** The line under the input; the "copied" note replaces it once the link was copied. */
    readonly note: string
    readonly isCopied: boolean
    readonly onCopy: () => void
}

/** An invitation link in a read-only copyable input, with a note that turns to "copied" after the copy. */
export const InviteLink = (props: InviteLinkProps) => (
    <Stack gap="identity">
        <Input
            id={props.id}
            name="inviteLink"
            label={props.label}
            value={props.link}
            isReadOnly
            isCopyable
            copyLabel={props.copyLabel}
            copiedLabel={props.copiedLabel}
            onCopy={props.onCopy}
        />
        {props.isCopied || props.note !== "" ? (
            <Text size="xs" tone="muted" live="polite">
                {props.isCopied ? props.copiedLabel : props.note}
            </Text>
        ) : null}
    </Stack>
)
