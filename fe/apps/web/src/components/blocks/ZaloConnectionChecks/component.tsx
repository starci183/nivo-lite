import { Badge, Button, ListRow } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import { ZaloSection } from "@/components/composites/ZaloSection"
import type { DataSlot, SlotLabels, ZaloCheckLineView } from "@/modules/types"

/** Fake rows of the same shape: the skeleton reuses the ready tree. */
export const ZALO_CHECKS_PLACEHOLDER: ReadonlyArray<ZaloCheckLineView> = [
    { key: "app", mark: "ok", title: "-", detail: "-", canRecheck: false },
    { key: "token", mark: "ok", title: "-", detail: "-", canRecheck: true },
    { key: "webhook", mark: "ok", title: "-", detail: "-", canRecheck: false },
    { key: "permissions", mark: "ok", title: "-", detail: "-", canRecheck: false },
]

/** Copy, slot and command of the check list. */
export interface ZaloConnectionChecksBaseProps {
    readonly props: {
        readonly title: string
        readonly lines: DataSlot<ReadonlyArray<ZaloCheckLineView>>
        readonly slotLabels: SlotLabels
        readonly markLabels: Readonly<Record<ZaloCheckLineView["mark"], string>>
        readonly recheckLabel: string
        readonly isRechecking: boolean
    }
    readonly on: { readonly recheck: () => void; readonly retry: () => void }
}

const TONES = { ok: "success", fail: "danger", warn: "warning" } as const

/** Draws the check list: each part of the connection with a verdict and a detail line. */
export const ZaloConnectionChecksBase = (props: ZaloConnectionChecksBaseProps) => (
    <SlotView
        slot={props.props.lines}
        placeholder={ZALO_CHECKS_PLACEHOLDER}
        labels={props.props.slotLabels}
        onRetry={props.on.retry}
    >
        {(lines, isSkeleton) => (
            <ZaloSection title={props.props.title} isSkeleton={isSkeleton}>
                {lines.map((line) => (
                    <ListRow
                        key={line.key}
                        title={line.title}
                        description={line.detail}
                        isSkeleton={isSkeleton}
                        badges={
                            <Badge isDot tone={TONES[line.mark]} isSkeleton={isSkeleton}>
                                {props.props.markLabels[line.mark]}
                            </Badge>
                        }
                        actions={
                            line.canRecheck ? (
                                <Button
                                    intent="neutral"
                                    isPending={props.props.isRechecking}
                                    isSkeleton={isSkeleton}
                                    onPress={props.on.recheck}
                                >
                                    {props.props.recheckLabel}
                                </Button>
                            ) : undefined
                        }
                    />
                ))}
            </ZaloSection>
        )}
    </SlotView>
)
