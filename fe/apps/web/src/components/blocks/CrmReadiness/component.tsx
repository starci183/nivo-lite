import { SlotView } from "@nivo-lite/agent-sdk/client"
import { Stack, SurfaceCard } from "@starci/grammar/common"
import { CrmOperationsCard } from "@/components/composites/CrmOperationsCard"
import { CRM_VIEW_PLACEHOLDER, crmReadinessOf, type CrmView } from "@/modules/crm"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** The words and the read of the readiness card of a CRM connection. */
export interface CrmReadinessBaseProps {
    readonly props: {
        readonly slot: DataSlot<CrmView>
        readonly slotLabels: SlotLabels
        readonly text: Readonly<Record<"title" | "factCrmId" | "factNeeded" | "missingTitle" | "missingEmpty" | "noPin", string>>
        readonly readyLabel: (view: CrmView) => string
        readonly stateLabel: (state: string) => string
        readonly stateTone: (state: string) => "success" | "warning"
    }
    readonly on: { readonly retry: () => void }
}

/**
 * How the connection stands against the installed packages: the CRM id, how many operations the packages need are ready, and (when
 * some are not) which ones the live Swagger lacks, by name.
 */
export const CrmReadinessBase = (props: CrmReadinessBaseProps) => (
    <SlotView
        slot={props.props.slot}
        placeholder={CRM_VIEW_PLACEHOLDER}
        labels={props.props.slotLabels}
        onRetry={props.on.retry}
        render={(view, isLoading) => (
            <Stack gap="region">
                <SurfaceCard
                    kind="details"
                    label={props.props.text.title}
                    isLoading={isLoading}
                    items={[
                        { id: "crm", term: props.props.text.factCrmId, description: `crm.${view.crmId}` },
                        {
                            id: "needed",
                            term: props.props.text.factNeeded,
                            description: view.pin === null ? props.props.text.noPin : props.props.readyLabel(view),
                        },
                    ]}
                />
                {crmReadinessOf(view.pin).missing.length === 0 ? null : (
                    <CrmOperationsCard
                        label={props.props.text.missingTitle}
                        headingLevel={2}
                        isLoading={isLoading}
                        empty={props.props.text.missingEmpty}
                        rows={crmReadinessOf(view.pin).missing.map((operation) => ({
                            id: operation.op,
                            title: operation.op,
                            description: `${operation.method ?? ""} ${operation.path ?? ""}`.trim(),
                            badge: { label: props.props.stateLabel(operation.state), tone: props.props.stateTone(operation.state) },
                        }))}
                    />
                )}
            </Stack>
        )}
    />
)
