import { SlotView } from "@nivo-lite/agent-sdk/client"
import { Alert, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import { CrmOperationsCard } from "@/components/composites/CrmOperationsCard"
import { CRM_VIEW_PLACEHOLDER, type CrmView } from "@/modules/crm"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** The words, the read and the commands of the API tab of a CRM connection. */
export interface CrmApiTabBaseProps {
    readonly props: {
        readonly slot: DataSlot<CrmView>
        readonly slotLabels: SlotLabels
        readonly isPending: boolean
        readonly error: string | null
        readonly text: Readonly<
            Record<
                | "lead"
                | "neededTitle"
                | "othersTitle"
                | "empty"
                | "snapshotTitle"
                | "snapshotNone"
                | "repin"
                | "repinHint"
                | "factCrmId"
                | "factBaseUrl"
                | "factSwagger"
                | "factSha"
                | "factPinnedAt",
                string
            >
        >
        readonly stateLabel: (state: string) => string
        readonly stateTone: (state: string) => "success" | "warning"
        readonly shortSha: (sha: string) => string
        readonly pinnedAtLabel: (iso: string) => string
    }
    readonly on: { readonly repin: () => void; readonly retry: () => void }
}

/** The drawing props with the view of the snapshot and its loading atom. */
interface SnapshotCardsProps extends CrmApiTabBaseProps {
    readonly view: CrmView
    readonly isLoading: boolean
}

/** The snapshot of the live Swagger: its facts, and the one command that pins the live document again. */
const SnapshotCards = (props: SnapshotCardsProps) => {
    const { props: base, on, view, isLoading } = props
    const pin = view.pin
    return (
        <>
            <SurfaceCard
                kind="list"
                ariaLabel={base.text.snapshotTitle}
                isLoading={isLoading}
                empty={null}
                items={[
                    {
                        id: "repin",
                        title: pin === null ? base.text.snapshotNone : base.text.repinHint,
                        action: { label: base.text.repin, press: on.repin, isPending: base.isPending },
                    },
                ]}
            />
            {pin === null ? null : (
                <SurfaceCard
                    kind="details"
                    label={base.text.snapshotTitle}
                    isLoading={isLoading}
                    items={[
                        { id: "crm", term: base.text.factCrmId, description: pin.connector },
                        { id: "base", term: base.text.factBaseUrl, description: view.baseUrl },
                        { id: "swagger", term: base.text.factSwagger, description: pin.swaggerUrl },
                        { id: "sha", term: base.text.factSha, description: base.shortSha(pin.documentSha256) },
                        { id: "at", term: base.text.factPinnedAt, description: base.pinnedAtLabel(pin.pinnedAt) },
                    ]}
                />
            )}
        </>
    )
}

/**
 * The API tab of a CRM provider via OpenAPI: the operations generated from the pinned Swagger, read only (the ones the installed
 * packages need with their state, then the other operations of the snapshot), the snapshot's facts, and "re-pin".
 */
export const CrmApiTabBase = (props: CrmApiTabBaseProps) => (
    <Stack gap="section">
        <Text size="xs" tone="muted">
            {props.props.text.lead}
        </Text>
        <SlotView
            slot={props.props.slot}
            placeholder={CRM_VIEW_PLACEHOLDER}
            labels={props.props.slotLabels}
            onRetry={props.on.retry}
            render={(view, isLoading) => (
                <Stack gap="region">
                    {props.props.error === null ? null : <Alert tone="negative" title={props.props.error} isLoading={isLoading} />}
                    <CrmOperationsCard
                        label={props.props.text.neededTitle}
                        headingLevel={2}
                        isLoading={isLoading}
                        empty={props.props.text.empty}
                        rows={(view.pin?.needed ?? []).map((operation) => ({
                            id: operation.op,
                            title: operation.op,
                            description: `${operation.method ?? ""} ${operation.path ?? ""}`.trim(),
                            badge: { label: props.props.stateLabel(operation.state), tone: props.props.stateTone(operation.state) },
                        }))}
                    />
                    <CrmOperationsCard
                        label={props.props.text.othersTitle}
                        headingLevel={2}
                        isLoading={isLoading}
                        empty={props.props.text.empty}
                        rows={(view.pin?.others ?? []).map((operation) => ({
                            id: operation.op,
                            title: operation.op,
                            description: `${operation.method} ${operation.path}`,
                        }))}
                    />
                    <SnapshotCards {...props} view={view} isLoading={isLoading} />
                </Stack>
            )}
        />
    </Stack>
)
