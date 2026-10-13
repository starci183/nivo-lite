import { inventoryStarterOf } from "@modules/domain/inventory"
import type { ApplyStarterParams } from "@modules/domain/inventory"

/** The starter payload of one key; an unknown key is invalid. */
export const starterOf = (key: string): ApplyStarterParams => inventoryStarterOf(key)
