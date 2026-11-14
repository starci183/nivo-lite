import { ToolReceiptEntity } from "./tool-receipt.entity"

export { ToolReceiptEntity }

/** The entities the tool-receipts capability owns, collected by the database module. */
export const toolReceiptsEntities: readonly [typeof ToolReceiptEntity] = [ToolReceiptEntity] as const
