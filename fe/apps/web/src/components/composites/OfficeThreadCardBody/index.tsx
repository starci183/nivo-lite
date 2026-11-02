import { OfficeApprovalCard } from "@/components/branches/OfficeApprovalCard"
import { OfficeCommandCard } from "@/components/branches/OfficeCommandCard"
import { OfficeExceptionCard } from "@/components/branches/OfficeExceptionCard"
import { OfficeExceptionForm } from "@/components/branches/OfficeExceptionForm"
import { OfficeResultCard } from "@/components/branches/OfficeResultCard"
import type { OfficeCardDraft, OfficeThreadItem, OfficeThreadProps } from "@/modules/types"

type OfficeCardItem = Exclude<OfficeThreadItem, { readonly kind: "day" | "message" }>

/** The settled card body has resolved data and commands; its block owns the surrounding message frame. */
interface OfficeThreadCardBodyProps {
    readonly item: OfficeCardItem
    readonly draft: OfficeCardDraft
    readonly isBusy: boolean
    readonly basisMin: number
    readonly basisDescription: string | null
    readonly copy: OfficeThreadProps["props"]["cardCopy"]
    readonly onEdit: OfficeThreadProps["on"]["editCard"]
    readonly onDecideApproval: OfficeThreadProps["on"]["decideApproval"]
    readonly onDecideWork: OfficeThreadProps["on"]["decideWork"]
    readonly onDecideCard: OfficeThreadProps["on"]["decideCard"]
    readonly onSend: OfficeThreadProps["on"]["sendCommand"]
    readonly onCancel: OfficeThreadProps["on"]["cancelCommand"]
}

/** Keeps each card's original decision/editor controls inside the message host chosen by the block. */
export const OfficeThreadCardBody = (props: OfficeThreadCardBodyProps) => {
    const item = props.item
    if (item.kind === "approval")
        return (
            <OfficeApprovalCard
                approval={item}
                copy={props.copy.approval}
                draft={props.draft}
                onEdit={props.onEdit}
                isBusy={props.isBusy}
                onDecide={props.onDecideApproval}
            />
        )
    if (item.kind === "exception")
        return (
            <OfficeExceptionCard
                item={item}
                copy={props.copy.exception}
                form={
                    <OfficeExceptionForm
                        item={item}
                        copy={props.copy.exceptionForm}
                        basisMin={props.basisMin}
                        basisDescription={props.basisDescription}
                        draft={props.draft}
                        onEdit={props.onEdit}
                        isBusy={props.isBusy}
                        onDecide={props.onDecideWork}
                    />
                }
            />
        )
    if (item.kind === "command")
        return (
            <OfficeCommandCard
                command={item}
                agent={item.agent}
                copy={props.copy.command}
                gateNote={item.note}
                isBusy={props.isBusy}
                onSend={props.onSend}
                onCancel={props.onCancel}
            />
        )
    return (
        <OfficeResultCard
            card={item}
            copy={props.copy.result}
            draft={props.draft}
            onEdit={props.onEdit}
            isBusy={props.isBusy}
            onDecide={props.onDecideCard}
        />
    )
}
