import { SurfaceCard, Text, Textarea } from "@starci/grammar/common"
import type { OfficeResultCardView, OfficeThreadProps } from "@/modules/types"
import { QUOTE_CLASS_NAME } from "./classNames"

/** What the long copy of a result card draws, and its editor while the owner edits the draft. */
type OfficeCardBodyProps = {
    readonly card: OfficeResultCardView
    readonly copy: OfficeThreadProps["props"]["cardCopy"]["result"]
    readonly isEditing: boolean
    readonly draft: string
    readonly setDraft: (value: string) => void
    readonly isBusy: boolean
}

/** The long copy of a result card (caption, reason, report), or the editor while the owner edits the draft. */
export const OfficeCardBody = (props: OfficeCardBodyProps) => {
    if (props.isEditing)
        return (
            <Textarea
                label={props.copy.draftLabel}
                rows={6}
                value={props.draft}
                isDisabled={props.isBusy}
                onValueChange={props.setDraft}
            />
        )
    if (props.card.body === null) return null
    return (
        <SurfaceCard ariaLabel={props.copy.draftLabel}>
            <div className={QUOTE_CLASS_NAME}>
                <Text as="p" size="sm">
                    {props.card.body}
                </Text>
            </div>
        </SurfaceCard>
    )
}
