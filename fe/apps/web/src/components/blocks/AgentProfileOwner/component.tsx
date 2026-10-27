import { Alert, Badge, SurfaceCard, Text } from "@starci/grammar/common"
import { SlotBoundView } from "@/components/composites/SlotView"
import { PersonAvatar } from "@/components/leaves/PersonAvatar"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { COPY_CLASS, PERSON_CLASS, STACK_CLASS } from "./classNames"

/** Who answers for the agent, with every word resolved. */
export interface OwnerView {
    readonly name: string
    readonly roleLabel: string
    readonly note: string
    /** The notice shown when the stored owner left or was disabled; null otherwise. */
    readonly notice: { readonly title: string; readonly description: string } | null
    /** The person who takes over when the responder cannot; null when none is named. */
    readonly fallback: { readonly label: string; readonly name: string } | null
}

/** Copy and state of the "Nguoi phu trach" card. */
export interface AgentProfileOwnerBaseProps {
    readonly props: {
        readonly title: string
        readonly slot: DataSlot<OwnerView>
        readonly placeholder: OwnerView
        readonly slotLabels: SlotLabels
    }
    readonly on: { readonly retry: () => void }
}

/** Draws who answers for the agent, with the fallback and a notice when the owner is gone. */
export const AgentProfileOwnerBase = (props: AgentProfileOwnerBaseProps) => (
    <SurfaceCard label={props.props.title} headingLevel={2}>
        <SlotBoundView from={props.props} onRetry={props.on.retry}>
            {(owner, isSkeleton) => (
                <div className={STACK_CLASS}>
                    <div className={PERSON_CLASS}>
                        <PersonAvatar name={owner.name} size="lg" />
                        <div className={COPY_CLASS}>
                            <Text weight="medium" isSkeleton={isSkeleton}>
                                {owner.name}
                            </Text>
                            <Text size="sm" tone="muted" isSkeleton={isSkeleton}>
                                {owner.roleLabel}
                            </Text>
                            <Text size="sm" tone="muted" isSkeleton={isSkeleton}>
                                {owner.note}
                            </Text>
                        </div>
                    </div>
                    {owner.notice === null ? null : (
                        <Alert tone="cautionary" title={owner.notice.title} description={owner.notice.description} />
                    )}
                    {owner.fallback === null ? null : (
                        <Text size="sm" tone="muted">
                            <Badge tone="neutral">{owner.fallback.label}</Badge> {owner.fallback.name}
                        </Text>
                    )}
                </div>
            )}
        </SlotBoundView>
    </SurfaceCard>
)
