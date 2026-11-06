/** Log events of the workbench door. */
export enum WorkbenchDoorLogEvent {
    /** A read or action asked for a port the door does not provide: a gap in a declaration or in the door. */
    PortUnprovided = "workbench-door.port_unprovided",
    /** An action refused its input as invalid: the action name and the keys of the refused fields, never a value. */
    InputInvalid = "workbench-door.input_invalid",
}
