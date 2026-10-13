import { EMPTY_INVENTORY_BOARD } from "./inventoryBoard.shared"
import { useInventoryWorkbenchData } from "@/hooks/inventoryWorkbench"

/** The inventory board for a tab that draws its empty state until the first read lands. */
export const useInventoryBoard = () => useInventoryWorkbenchData().data ?? EMPTY_INVENTORY_BOARD
