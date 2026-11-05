/** Log events of the workbench door. */
export enum WorkbenchDoorLogEvent {
    /** A read or action asked for a port the door does not provide: a gap in a declaration or in the door. */
    PortUnprovided = "workbench-door.port_unprovided",
}
