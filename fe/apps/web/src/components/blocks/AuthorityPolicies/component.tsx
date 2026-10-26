import { Textarea } from "@starci/grammar/common"
import { AuthoritySection } from "@/components/composites/AuthoritySection"
import type { AuthoritySectionView } from "@/components/composites/AuthoritySection"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** Copy, values and state of the policies section. */
export interface AuthorityPoliciesBaseProps {
    readonly props: {
        readonly section: AuthoritySectionView
        readonly policiesLabel: string
        readonly policiesHint: string
        readonly replyStyleLabel: string
        readonly replyStyleHint: string
        readonly brandVoiceLabel: string
        readonly brandVoiceHint: string
        readonly slot: DataSlot<boolean>
        readonly slotLabels: SlotLabels
        readonly policies: string
        readonly replyStyle: string
        readonly brandVoice: string
    }
    readonly on: {
        readonly policies: (value: string) => void
        readonly replyStyle: (value: string) => void
        readonly brandVoice: (value: string) => void
        readonly save: () => void
        readonly retry: () => void
    }
}

/** Draws the policies section: business rules, reply style and brand voice. */
export const AuthorityPoliciesBase = (props: AuthorityPoliciesBaseProps) => {
    const view = props.props
    return (
        <SlotView slot={view.slot} placeholder={false} labels={view.slotLabels} onRetry={props.on.retry}>
            {(_, isSkeleton) => (
                <AuthoritySection section={view.section} isSkeleton={isSkeleton} onSave={props.on.save}>
                    <Textarea
                        isSkeleton={isSkeleton}
                        label={view.policiesLabel}
                        description={view.policiesHint}
                        rows={4}
                        value={view.policies}
                        onValueChange={props.on.policies}
                    />
                    <Textarea
                        isSkeleton={isSkeleton}
                        label={view.replyStyleLabel}
                        description={view.replyStyleHint}
                        rows={2}
                        value={view.replyStyle}
                        onValueChange={props.on.replyStyle}
                    />
                    <Textarea
                        isSkeleton={isSkeleton}
                        label={view.brandVoiceLabel}
                        description={view.brandVoiceHint}
                        rows={2}
                        value={view.brandVoice}
                        onValueChange={props.on.brandVoice}
                    />
                </AuthoritySection>
            )}
        </SlotView>
    )
}
