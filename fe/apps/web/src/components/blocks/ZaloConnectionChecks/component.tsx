import { ConnectionLines } from "@/components/composites/ConnectionLines"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels, ZaloCheckLineView } from "@/modules/types"

/** Fake rows of the same shape: the skeleton reuses the ready tree. */
export const ZALO_CHECKS_PLACEHOLDER: ReadonlyArray<ZaloCheckLineView> = [
    { key: "app", mark: "ok", title: "-", detail: "-" },
    { key: "token", mark: "ok", title: "-", detail: "-" },
    { key: "webhook", mark: "ok", title: "-", detail: "-" },
    { key: "permissions", mark: "ok", title: "-", detail: "-" },
]

/** Copy and slot of the check list. */
export interface ZaloConnectionChecksBaseProps {
    readonly props: {
        readonly title: string
        readonly lines: DataSlot<ReadonlyArray<ZaloCheckLineView>>
        readonly slotLabels: SlotLabels
        readonly markLabels: Readonly<Record<ZaloCheckLineView["mark"], string>>
    }
    readonly on: { readonly retry: () => void }
}

const TONES = { ok: "success", fail: "danger", warn: "warning" } as const

/** Draws the check list of the fourth setup step: each part of the connection with its verdict and the line that says how to fix it. */
export const ZaloConnectionChecksBase = (props: ZaloConnectionChecksBaseProps) => (
    <SlotView
        slot={props.props.lines}
        placeholder={ZALO_CHECKS_PLACEHOLDER}
        labels={props.props.slotLabels}
        onRetry={props.on.retry}
    >
        {(lines, isSkeleton) => (
            <ConnectionLines
                label={props.props.title}
                isSkeleton={isSkeleton}
                lines={lines.map((line) => ({
                    id: line.key,
                    title: line.title,
                    description: line.detail,
                    badge: { label: props.props.markLabels[line.mark], tone: TONES[line.mark], isDot: true },
                }))}
            />
        )}
    </SlotView>
)
