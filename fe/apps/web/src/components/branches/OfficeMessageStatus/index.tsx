import { AvatarGroup, Text } from "@starci/grammar/common"
import { Icon } from "@/components/leaves/Icon"
import type { IconName } from "@/components/leaves/Icon"
import type { OfficeMessageStatusKind, OfficeMessageStatusView, OfficeText } from "@/modules/types"
import { STATUS_CLASS_NAME } from "./classNames"

/** What the status line draws. */
type OfficeMessageStatusProps = {
    readonly status: OfficeMessageStatusView
    readonly text: OfficeText
}

/** Readers drawn as avatars before the rest collapse into a count. */
const READERS_SHOWN = 3

const ICONS: Readonly<Record<Exclude<OfficeMessageStatusKind, "seen">, IconName>> = {
    sent: "messageSent",
    delivered: "messageDelivered",
}

/** The read mark no icon set ships as one glyph: two ticks side by side. */
const seenMark = (
    <>
        <Icon props={{ name: "messageSeen", usage: "chip" }} />
        <Icon props={{ name: "messageSeen", usage: "chip" }} />
    </>
)

/** Under my last message: sent (check), delivered (double check), seen (accent double check and the readers' pictures with generated-avatar fallbacks). */
export const OfficeMessageStatus = (props: OfficeMessageStatusProps) => {
    const { status, text } = props
    return (
        <div className={STATUS_CLASS_NAME}>
            <Text
                size="xs"
                tone={status.kind === "seen" ? "accent" : "muted"}
                live="polite"
                startContent={
                    status.kind === "seen" ? seenMark : <Icon props={{ name: ICONS[status.kind], usage: "chip" }} />
                }
            >
                {status.label}
            </Text>
            {status.readers.length === 0 ? null : (
                <AvatarGroup
                    label={status.label}
                    size="sm"
                    max={READERS_SHOWN}
                    items={status.readers.map((reader) => ({
                        id: reader.id,
                        name: reader.name,
                        seed: reader.id,
                        ...(reader.avatarUrl === null ? {} : { src: reader.avatarUrl }),
                    }))}
                    overflowLabel={(n) => text("readersOverflow", { n })}
                />
            )}
            {status.moreReaders > 0 ? (
                <Text size="xs" tone="muted">
                    {text("readersOverflow", { n: status.moreReaders })}
                </Text>
            ) : null}
        </div>
    )
}
