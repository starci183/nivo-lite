import { hasEmailAddressShape } from "@modules/platform/primitives"
import type { UnitConversion } from "../inventory.contracts"
import { foldText, parseNumber } from "./number-format.policy"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

const ISO_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/u

/** The longest SKU derived from a name. */
const DERIVED_SKU_MAX = 20

/** Most entries a comma list (aliases) keeps. */
const LIST_MAX = 20

/** The longest unit name. */
const UNIT_NAME_MAX = 30

/** Trims a typed value and cuts it to `max` characters. */
export const clip = (value: string, max: number): string => value.trim().slice(0, max)

/** True for a UUID in any case. */
export const isUuid = (value: string): boolean => UUID_PATTERN.test(value)

/** The value when it is a UUID, otherwise null. */
export const uuidOrNull = (value: string | undefined): string | null =>
    value !== undefined && isUuid(value) ? value : null

/** True for a YYYY-MM-DD day. */
export const isIsoDay = (value: string): boolean => ISO_DAY_PATTERN.test(value)

/** True for something shaped like an email address. */
export const isEmailAddress = (value: string): boolean => hasEmailAddressShape(value)

/** Reads `unit=factor` pairs separated by commas, semicolons or line breaks; pairs without a positive factor are dropped. */
export const parseUnitPairs = (text: string): Array<UnitConversion> =>
    text
        .split(/[,;\n]/u)
        .map((pair) => pair.split("="))
        .flatMap(([unit, factor]) =>
            unit !== undefined && factor !== undefined && unit.trim() !== "" && parseNumber(factor) > 0
                ? [{ unit: unit.trim().slice(0, UNIT_NAME_MAX), factor: parseNumber(factor) }]
                : [],
        )

/** Reads a comma, semicolon or line-break separated list, without blanks, at most twenty entries. */
export const parseCommaList = (text: string): Array<string> =>
    text
        .split(/[,;\n]/u)
        .map((entry) => entry.trim())
        .filter((entry) => entry !== "")
        .slice(0, LIST_MAX)

/** The SKU a new item gets from its name when the owner typed none. */
export const deriveSku = (name: string): string =>
    foldText(name)
        .toUpperCase()
        .replace(/[^A-Z0-9]+/gu, "-")
        .replace(/^-|-$/gu, "")
        .slice(0, DERIVED_SKU_MAX) || "ITEM"
