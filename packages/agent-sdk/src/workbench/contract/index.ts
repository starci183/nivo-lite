export type { DataSlot, ForbiddenTest, SlotLabels, SlotPanelProps, SlotRead } from "../../slot/slot.types"
export { loadingSlot, mapSlot, slotOfRead, slotOfReads } from "../../slot/slot"
export type {
    WorkbenchCommand,
    WorkbenchDataPort,
    WorkbenchFailureReason,
    WorkbenchFeedbackPort,
    WorkbenchFormat,
    WorkbenchHost,
    WorkbenchI18nPort,
    WorkbenchMessageValues,
    WorkbenchNavigationPort,
    WorkbenchOperation,
    WorkbenchOutcome,
    WorkbenchPermissionPort,
    WorkbenchQuery,
    WorkbenchShellInput,
    WorkbenchShellPort,
    WorkbenchShellState,
    WorkbenchTranslate,
} from "../host/host.types"
export type {
    WorkbenchDeclaration,
    WorkbenchExposes,
    WorkbenchModule,
    WorkbenchProblem,
    WorkbenchProblemCode,
    WorkbenchRender,
    WorkbenchRouteProps,
    WorkbenchViewDefinition,
} from "./workbench.types"
export { defineWorkbench, specRegistryFrom, viewIdOf, workbenchProblems, workbenchRegistryOf } from "./workbench"
