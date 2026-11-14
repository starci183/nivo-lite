import { DomainError, type ErrorKind } from "@modules/platform/errors"

/** Codes of the workbench door. */
export enum WorkbenchDoorErrorCode {
    /** The name matches no read of any module the door serves. */
    ReadUnknown = "WORKBENCH_DOOR_READ_UNKNOWN",
    /** The name matches no action of any module the door serves. */
    ActionUnknown = "WORKBENCH_DOOR_ACTION_UNKNOWN",
    /** The variables or the input are not JSON, or do not match what the read or action declares. */
    PayloadInvalid = "WORKBENCH_DOOR_PAYLOAD_INVALID",
    /** The member does not hold the permission the read or action declares. */
    PermissionDenied = "WORKBENCH_DOOR_PERMISSION_DENIED",
    /** A read or action needs a port the door does not provide. */
    PortUnprovided = "WORKBENCH_DOOR_PORT_UNPROVIDED",
    /** A transactional action lists a port that calls out of the system (BE-PERSISTENCE-6). */
    ExternalInTx = "WORKBENCH_DOOR_EXTERNAL_IN_TX",
    /** Two modules declare the same read or action id. */
    RegistryDuplicate = "WORKBENCH_DOOR_REGISTRY_DUPLICATE",
    /** A read or action id has none of the lawful forms (`isOperationId`). */
    RegistryIdInvalid = "WORKBENCH_DOOR_REGISTRY_ID_INVALID",
    /** A read or action lists a port nothing provides. */
    RegistryPortUnknown = "WORKBENCH_DOOR_REGISTRY_PORT_UNKNOWN",
    /** A list read or an entity port names an entity no module declares. */
    RegistryEntityMissing = "WORKBENCH_DOOR_REGISTRY_ENTITY_MISSING",
    /** The action ran into a version or constraint conflict; the screen refreshes and tries again. */
    ActionConflict = "WORKBENCH_DOOR_ACTION_CONFLICT",
    /** The action did not finish; it may succeed when tried again. */
    ActionFailed = "WORKBENCH_DOOR_ACTION_FAILED",
    /** The authority rules ask a person before the action runs. */
    ActionRefused = "WORKBENCH_DOOR_ACTION_REFUSED",
    /** A file call names a read or action that does not reach the record type it names. */
    FileNotDeclared = "WORKBENCH_DOOR_FILE_NOT_DECLARED",
}

/** How each workbench door code travels. */
export const WORKBENCH_DOOR_ERROR_KINDS: Record<WorkbenchDoorErrorCode, ErrorKind> = {
    [WorkbenchDoorErrorCode.ReadUnknown]: "not-found",
    [WorkbenchDoorErrorCode.ActionUnknown]: "not-found",
    [WorkbenchDoorErrorCode.PayloadInvalid]: "invalid",
    [WorkbenchDoorErrorCode.PermissionDenied]: "forbidden",
    [WorkbenchDoorErrorCode.PortUnprovided]: "internal",
    [WorkbenchDoorErrorCode.ExternalInTx]: "internal",
    [WorkbenchDoorErrorCode.RegistryDuplicate]: "internal",
    [WorkbenchDoorErrorCode.RegistryIdInvalid]: "internal",
    [WorkbenchDoorErrorCode.RegistryPortUnknown]: "internal",
    [WorkbenchDoorErrorCode.RegistryEntityMissing]: "internal",
    [WorkbenchDoorErrorCode.ActionConflict]: "conflict",
    [WorkbenchDoorErrorCode.ActionFailed]: "unavailable",
    [WorkbenchDoorErrorCode.ActionRefused]: "conflict",
    [WorkbenchDoorErrorCode.FileNotDeclared]: "forbidden",
}

/** The one error class of the workbench door capability. */
export class WorkbenchDoorError extends DomainError<WorkbenchDoorErrorCode> {}
