import type { useTranslations } from "next-intl"
import type { LoyaltyConfigType } from "@/hooks/swr"
import type { CategoryValues, ProgramCopy, ProgramValues, TierValues } from "@/modules/types"

/** The most earn rules for single categories a programme keeps. */
export const MAX_CATEGORIES = 12

/** The most tiers a programme keeps. */
export const MAX_TIERS = 8

/** A clock time as hh:mm. */
export const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

/** What the form shows before the programme is loaded. */
export const BLANK_PROGRAM: ProgramValues = {
    name: "",
    enabled: false,
    perThousand: "",
    perVisit: "",
    minOrder: "",
    trigger: "payment",
    categories: [],
    tiers: [],
    expiryMonths: "",
    warnDays: "",
    birthdayOn: false,
    birthdayPoints: "",
    birthdayReward: "",
    birthdayNote: "",
    maxPerMonth: "",
    hourFrom: "08:00",
    hourTo: "21:00",
    batch: "",
}

/** A number typed with a comma or a point; the fallback when it is not a number. */
export const toNumber = (text: string, fallback = 0): number => {
    const parsed = Number(text.replace(",", "."))
    return Number.isFinite(parsed) ? parsed : fallback
}

/** A new tier row: a random id keeps it steady while its fields change. */
export const blankTier = (): TierValues => ({
    uid: crypto.randomUUID(),
    key: "",
    name: "",
    minSpend: "",
    multiplier: "1",
    winback: "45",
    benefit: "",
})

/** A new category rule row. */
export const blankCategory = (): CategoryValues => ({ uid: crypto.randomUUID(), match: "", rate: "1", label: "" })

/** The form values of a saved programme. */
export const programValuesOf = (name: string, enabled: boolean, config: LoyaltyConfigType): ProgramValues => ({
    name,
    enabled,
    perThousand: String(config.earn.perThousandVnd),
    perVisit: String(config.earn.perVisit),
    minOrder: String(config.earn.minOrderVnd),
    trigger: config.earn.trigger === "order" ? "order" : "payment",
    categories: config.earn.categories.map((category, position) => ({
        uid: `${category.match}|${category.label}|${config.earn.categories.slice(0, position).filter((other) => other.match === category.match && other.label === category.label).length}`,
        match: category.match,
        rate: String(category.perThousandVnd),
        label: category.label,
    })),
    tiers: config.tiers.map((tier) => ({
        uid: tier.key,
        key: tier.key,
        name: tier.name,
        minSpend: String(tier.minSpendVnd),
        multiplier: String(tier.multiplier),
        winback: String(tier.winbackDays),
        benefit: tier.benefit,
    })),
    expiryMonths: String(config.expiry.months),
    warnDays: String(config.expiry.warnDays),
    birthdayOn: config.birthday.enabled,
    birthdayPoints: String(config.birthday.points),
    birthdayReward: config.birthday.rewardKey,
    birthdayNote: config.birthday.note,
    maxPerMonth: String(config.promo.maxPerMonth),
    hourFrom: config.promo.hourFrom,
    hourTo: config.promo.hourTo,
    batch: String(config.promo.batch),
})

/** The `saveLoyaltyProgram` input for the form values: the first tier always starts at 0 and empty category rules are dropped. */
export const programInputOf = (values: ProgramValues) => ({
    name: values.name.trim(),
    enabled: values.enabled,
    config: {
        earn: {
            perThousandVnd: toNumber(values.perThousand),
            perVisit: toNumber(values.perVisit),
            minOrderVnd: toNumber(values.minOrder),
            trigger: values.trigger,
            categories: values.categories
                .filter((category) => category.match.trim() !== "")
                .map((category) => ({
                    match: category.match.trim(),
                    perThousandVnd: toNumber(category.rate),
                    label: category.label.trim(),
                })),
        },
        tiers: values.tiers.map((tier, position) => ({
            key: tier.key,
            name: tier.name.trim(),
            minSpendVnd: position === 0 ? 0 : toNumber(tier.minSpend),
            multiplier: toNumber(tier.multiplier, 1),
            winbackDays: toNumber(tier.winback, 45),
            benefit: tier.benefit.trim(),
        })),
        expiry: { months: toNumber(values.expiryMonths), warnDays: toNumber(values.warnDays, 30) },
        birthday: {
            enabled: values.birthdayOn,
            points: toNumber(values.birthdayPoints),
            rewardKey: values.birthdayReward,
            note: values.birthdayNote.trim(),
        },
        promo: {
            maxPerMonth: toNumber(values.maxPerMonth, 2),
            hourFrom: values.hourFrom,
            hourTo: values.hourTo,
            batch: toNumber(values.batch, 20),
        },
    },
})

/** The `loyalty` catalog's translator. */
type Translator = ReturnType<typeof useTranslations<"loyalty">>

/** Every label and hint of the programme form, resolved from the `loyalty` catalog. */
export const programCopyOf = (t: Translator): ProgramCopy =>
    ({
        readOnlyNote: t("readOnlyNote"),
        earnTitle: t("setEarnTitle"),
        earnHint: t("setEarnHint"),
        name: t("setName"),
        perThousand: t("setPerThousand"),
        perThousandHint: t("setPerThousandHint"),
        perVisit: t("setPerVisit"),
        minOrder: t("setMinOrder"),
        minOrderHint: t("setMinOrderHint"),
        trigger: t("setTrigger"),
        triggerHint: t("setTriggerHint"),
        categories: t("setCategories"),
        categoriesHint: t("setCategoriesHint"),
        catMatch: t("setCatMatch"),
        catRate: t("setCatRate"),
        catLabel: t("setCatLabel"),
        addCategory: t("setAddCategory"),
        remove: t("setRemove"),
        tiersTitle: t("setTiersTitle"),
        tiersHint: t("setTiersHint"),
        tierName: t("setTierName"),
        tierSpend: t("setTierSpend"),
        tierFirst: t("setTierFirst"),
        tierMult: t("setTierMult"),
        tierMultHint: t("setTierMultHint"),
        tierWinback: t("setTierWinback"),
        tierWinbackHint: t("setTierWinbackHint"),
        tierBenefit: t("setTierBenefit"),
        addTier: t("setAddTier"),
        expiryTitle: t("setExpiryTitle"),
        expiryHint: t("setExpiryHint"),
        expiryMonths: t("setExpiryMonths"),
        expiryMonthsHint: t("setExpiryMonthsHint"),
        warnDays: t("setWarnDays"),
        warnDaysHint: t("setWarnDaysHint"),
        birthdayTitle: t("setBirthdayTitle"),
        birthdayOn: t("setBirthdayOn"),
        birthdayPoints: t("setBirthdayPoints"),
        birthdayReward: t("setBirthdayReward"),
        birthdayNote: t("setBirthdayNote"),
        birthdayNoteHint: t("setBirthdayNoteHint"),
        promoTitle: t("setPromoTitle"),
        promoHint: t("setPromoHint"),
        maxPerMonth: t("setMaxPerMonth"),
        batch: t("setBatch"),
        batchHint: t("setBatchHint"),
        hourFrom: t("setHourFrom"),
        hourTo: t("setHourTo"),
        publicTitle: t("setPublicTitle"),
        publicHint: t("publicBody"),
        publicOn: t("setPublicOn"),
        publicLink: t("publicTitle"),
        copy: t("copy"),
        copied: t("copied"),
        save: t("setSave"),
    }) as const
