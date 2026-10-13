/** The queue name: the contract between the database function that submits a command and the processor of the inventory-command job (a pgmq queue name). */
export const INVENTORY_COMMAND_QUEUE = "inventory_command"

/** The payload of one inventory-command job: the submitted command to run. */
export interface InventoryCommandPayload {
    /** The workspace the command acts in. */
    readonly workspaceId: string
    /** The command row to run. */
    readonly commandId: string
}

/** True when a job payload is the payload of an inventory-command job. */
export const isInventoryCommandPayload = (value: unknown): value is InventoryCommandPayload =>
    typeof value === "object" &&
    value !== null &&
    "workspaceId" in value &&
    typeof value.workspaceId === "string" &&
    "commandId" in value &&
    typeof value.commandId === "string"
