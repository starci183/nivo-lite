import { parseDate } from "@internationalized/date"
import type { SalesContractsBodyView, SalesContractEditorActions, ContractImportDialogEvents } from "@/modules/types"
import type { ReactNode } from "react"
import { Button, Cluster, Text } from "@starci/grammar/common"
import { ContractImportDialog } from "@/components/composites/ContractImportDialog"
import { SalesContractDrawer } from "@/components/composites/SalesContractDrawer"
interface SalesContractsBodyProps extends SalesContractsBodyView {
    readonly onAdd: () => void
    readonly onOpenImport: () => void
    readonly onDrawer: SalesContractEditorActions
    readonly onImport: ContractImportDialogEvents
    readonly children: ReactNode
}
/** Keeps date objects at the real DatePicker boundary; its owning block carries only ISO strings. */
export const SalesContractsBody = (props: SalesContractsBodyProps) => (
    <>
        <Text size="sm" tone="muted">
            {props.intro}
        </Text>
        <Cluster gap="inline">
            <Button intent="commit" size="sm" onPress={props.onAdd}>
                {props.addLabel}
            </Button>
            <Button intent="neutral" size="sm" onPress={props.onOpenImport}>
                {props.importLabel}
            </Button>
        </Cluster>
        <Text size="sm" isStrong live="polite">
            {props.note}
        </Text>
        {props.children}
        {props.drawer === null ? null : (
            <SalesContractDrawer
                props={{
                    ...props.drawer,
                    start: contractDateOf(props.drawer.start),
                    end: contractDateOf(props.drawer.end),
                }}
                on={{
                    ...props.onDrawer,
                    start: (value) => props.onDrawer.start(value?.toString() ?? ""),
                    end: (value) => props.onDrawer.end(value?.toString() ?? ""),
                }}
            />
        )}
        {props.importDialog === null ? null : <ContractImportDialog props={props.importDialog} on={props.onImport} />}
    </>
)
const contractDateOf = (text: string) => {
    try {
        return text ? parseDate(text) : null
    } catch {
        return null
    }
}
