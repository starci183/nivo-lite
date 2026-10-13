/** The structured log events of the module-ops capability. */
export enum ModuleOpsLogEvent {
    /** A line meant for the Office was only logged because the office capability is not connected. */
    OfficeLineLogged = "module-ops.office-line-logged",
    /** An entry meant for the decision log was only logged because the decisions capability is not connected. */
    DecisionLogged = "module-ops.decision-logged",
}
