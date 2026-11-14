/** Log events of the grant stores. */
export enum ToolGrantsLogEvent {
    /** The switch "node rights decide" could not be read (its table is missing or the database refused): the workspace is judged by the agent's ticks, as with the switch off. */
    NodeRightsSwitchUnreadable = "tool-grants.node-rights-switch.unreadable",
    /** The switch "node rights decide" of a workspace was turned on or off (the command line): the figures it read, and whether it was forced. */
    NodeRightsSwitchFlipped = "tool-grants.node-rights-switch.flipped",
}
