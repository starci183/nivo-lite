import { ConnectionLines } from "@/components/composites/ConnectionLines"
import { SlotView } from "@nivo/agent-sdk/workbench"
import { ZaloTestSend } from "@/components/composites/ZaloTestSend"
import type { ZaloTestSendProps } from "@/components/composites/ZaloTestSend"
import { ConnectionStepBand } from "@/components/frames/ConnectionStepBand"
import type { DataSlot, SlotLabels, ZaloCheckLineView, ZaloSendView } from "@/modules/types"

/** Fake rows of the same shape: the skeleton reuses the ready tree. */
const ZALO_CHECKS_PLACEHOLDER: ReadonlyArray<ZaloCheckLineView> = [
    { key: "app", mark: "ok", title: "-", detail: "-" },
    { key: "token", mark: "ok", title: "-", detail: "-" },
    { key: "webhook", mark: "ok", title: "-", detail: "-" },
    { key: "permissions", mark: "ok", title: "-", detail: "-" },
]

/** Fake data of the same shape: the skeleton reuses the ready tree. */
const ZALO_SEND_PLACEHOLDER: ZaloSendView = { options: [], blocked: "" }

/** Copy, slots and commands of the fourth setup step: the check list and the test send under it. */
export interface ZaloConnectionChecksBaseProps {
    readonly props: {
        /** The step's band: its place, words and whether it is open. */
        readonly step: {
            readonly ordinal: number
            readonly title: string
            readonly summary: string
            readonly hint: string
            readonly isOpen: boolean
        }
        readonly title: string
        readonly lines: DataSlot<ReadonlyArray<ZaloCheckLineView>>
        readonly slotLabels: SlotLabels
        readonly markLabels: Readonly<Record<ZaloCheckLineView["mark"], string>>
        readonly send: Omit<ZaloTestSendProps["props"], "view" | "isLoading">
        readonly sendView: DataSlot<ZaloSendView>
        readonly sendLabels: SlotLabels
    }
    readonly on: { readonly retry: () => void; readonly toggle: (isOpen: boolean) => void } & ZaloTestSendProps["on"]
}

const TONES = { ok: "success", fail: "danger", warn: "warning" } as const

/** Draws the fourth setup step: each part of the connection with its verdict and the line that says how to fix it, then the test send. */
export const ZaloConnectionChecksBase = (props: ZaloConnectionChecksBaseProps) => (
    <ConnectionStepBand {...props.props.step} onToggle={props.on.toggle}>
        <SlotView
            slot={props.props.lines}
            placeholder={ZALO_CHECKS_PLACEHOLDER}
            labels={props.props.slotLabels}
            onRetry={props.on.retry}
            render={(lines, isSkeleton) => (
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
        />
        <SlotView
            slot={props.props.sendView}
            placeholder={ZALO_SEND_PLACEHOLDER}
            labels={props.props.sendLabels}
            onRetry={props.on.retry}
            render={(view, isLoading) => (
                <ZaloTestSend
                    props={{ ...props.props.send, view, isLoading }}
                    on={{
                        pickRecipient: props.on.pickRecipient,
                        changeText: props.on.changeText,
                        send: props.on.send,
                    }}
                />
            )}
        />
    </ConnectionStepBand>
)
