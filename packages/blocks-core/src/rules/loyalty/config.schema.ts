import { z } from "zod"
import type { ZodType } from "zod"
import type { LoyaltyConfig } from "./config.types"

/** The most tiers a ladder holds. */
const TIERS_MAX = 8

/** The most category rates a programme holds. */
const CATEGORIES_MAX = 12

const tierShape = z.object({
    key: z.string().max(24),
    name: z.string().max(30),
    minSpendVnd: z.number(),
    multiplier: z.number(),
    winbackDays: z.number(),
    benefit: z.string().max(200),
})

const categoryShape = z.object({
    match: z.string().max(40),
    perThousandVnd: z.number(),
    label: z.string().max(40),
})

/** A type with its interfaces written out as plain object types, so a value of it is JSON the engine can store. */
type Plain<T> =
    T extends ReadonlyArray<infer Item>
        ? ReadonlyArray<Plain<Item>>
        : T extends object
          ? { readonly [Key in keyof T]: Plain<T[Key]> }
          : T

/** The rules of a programme as the entity keeps them. */
export type StoredLoyaltyConfig = Plain<LoyaltyConfig>

/**
 * The rules of a programme as the entity keeps them: the shape `resolveConfig` writes (every number clamped, the tiers sorted), so
 * the engine refuses a config that is not one. Reading goes through `resolveConfig` again.
 */
export const loyaltyConfigShape: ZodType<StoredLoyaltyConfig> = z.object({
    earn: z.object({
        perThousandVnd: z.number(),
        perVisit: z.number(),
        categories: z.array(categoryShape).max(CATEGORIES_MAX),
        trigger: z.enum(["payment", "order"]),
        minOrderVnd: z.number(),
    }),
    tiers: z.array(tierShape).max(TIERS_MAX),
    expiry: z.object({ months: z.number(), warnDays: z.number() }),
    birthday: z.object({
        enabled: z.boolean(),
        points: z.number(),
        rewardKey: z.string().max(40),
        note: z.string().max(200),
    }),
    promo: z.object({
        maxPerMonth: z.number(),
        hourFrom: z.string().max(5),
        hourTo: z.string().max(5),
        batch: z.number(),
    }),
})
