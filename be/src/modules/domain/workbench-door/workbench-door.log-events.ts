/** Log events of the workbench door. */
export enum WorkbenchDoorLogEvent {
    /** A read or action asked for a port the door does not provide: a gap in a declaration or in the door. */
    PortUnprovided = "workbench-door.port_unprovided",
    /** An action refused its input as invalid: the action name and the keys of the refused fields, never a value. */
    InputInvalid = "workbench-door.input_invalid",
    /** A person read a provider's data on a screen: who, which provider and read, what it came to and how many rows; never content. */
    ProviderRead = "workbench-door.provider_read",
}
