import { Icon } from "@/components/leaves/Icon"
import type { LeadIcon } from "@/modules/types"

/** The glyph of one lead mark. */
type LeadMarkProps = {
    readonly icon: LeadIcon
}

const MARKS: Readonly<Record<LeadIcon, { readonly name: LeadIcon; readonly usage: "chip" }>> = {
    account: { name: "account", usage: "chip" },
    brain: { name: "brain", usage: "chip" },
    complete: { name: "complete", usage: "chip" },
    close: { name: "close", usage: "chip" },
    pending: { name: "pending", usage: "chip" },
    review: { name: "review", usage: "chip" },
    send: { name: "send", usage: "chip" },
    notification: { name: "notification", usage: "chip" },
}

/** The small glyph that marks a brief line or a timeline entry of a lead. */
export const LeadMark = (props: LeadMarkProps) => <Icon props={MARKS[props.icon]} />
