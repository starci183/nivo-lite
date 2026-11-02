import type { ContractImportDialogEvents, ContractImportDialogView } from "@/modules/types"

export { ContractImportDialog } from "./component"

/** The resolved words, state and commands of the bulk contract import dialog. */
export interface ContractImportDialogProps {
    readonly props: ContractImportDialogView
    readonly on: ContractImportDialogEvents
}
