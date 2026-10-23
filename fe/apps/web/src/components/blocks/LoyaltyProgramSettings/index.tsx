"use client"

import type { BuildProgramCopyContext, BuildProgramCommandsContext } from "./component"
import { useTranslations } from "next-intl"
import {
    BLANK_PROGRAM,
    MAX_CATEGORIES,
    MAX_TIERS,
    blankCategory,
    blankTier,
    programValuesOf,
    useLoyaltyProgramSave,
    useSiteOrigin,
} from "@/hooks/loyaltyProgram"
import { maskCategoryField, maskProgramField, maskTierField } from "@/hooks/loyaltyProgramFields"
import { useLoyaltyProgramForm } from "@/hooks/rhf"
import { useQueryLoyaltyBoardSwr, useQueryLoyaltyProgramSwr } from "@/hooks/swr"
import { LoyaltyProgramSettingsBase } from "./component"

/** Which of the three states the programme query is in. */
const statusOf = (loaded: boolean, failed: boolean): "loading" | "failed" | "ready" => {
    if (failed) return "failed"
    return loaded ? "ready" : "loading"
}

/** The connected programme form: the whole programme in one form with one save (outcome toasted). */
export const LoyaltyProgramSettings = () => {
    const t = useTranslations("loyalty")
    const program = useQueryLoyaltyProgramSwr()
    const { data } = program
    const error: unknown = program.error
    const board = useQueryLoyaltyBoardSwr()
    const origin = useSiteOrigin()
    const saver = useLoyaltyProgramSave()
    const form = useLoyaltyProgramForm(
        data === undefined
            ? BLANK_PROGRAM
            : programValuesOf(data.program?.name ?? "", data.program?.enabled ?? false, data.config),
    )
    const values = form.watch()
    const errors = form.formState.errors
    const touch = { shouldDirty: true, shouldValidate: form.formState.isSubmitted }
    const submit = form.handleSubmit((submitted) => saver.save(submitted))
    const slug = data?.program?.slug
    return (
        <LoyaltyProgramSettingsBase
            props={{
                status: statusOf(data !== undefined, error !== undefined),
                loadingText: t("loading"),
                failedTitle: t("programFailed"),
                ...(error instanceof Error ? { failedDescription: error.message } : {}),
                canEdit: board.data?.canManage === true,
                isPending: saver.isPending,
                values,
                errors: {
                    name: errors.name?.message,
                    tiers: errors.tiers?.root?.message ?? errors.tiers?.message,
                    hourFrom: errors.hourFrom?.message,
                    hourTo: errors.hourTo?.message,
                },
                tierErrors: values.tiers.map((_tier, position) => ({
                    name: errors.tiers?.[position]?.name?.message,
                    minSpend: errors.tiers?.[position]?.minSpend?.message,
                })),
                canAddCategory: values.categories.length < MAX_CATEGORIES,
                canAddTier: values.tiers.length < MAX_TIERS,
                triggerOptions: [
                    { id: "payment", label: t("triggerPayment") },
                    { id: "order", label: t("triggerOrder") },
                ],
                rewardOptions: [
                    { id: "none", label: t("birthdayNoReward") },
                    ...(data?.rewards ?? []).map((reward) => ({ id: reward.key, label: reward.name })),
                ],
                ...(slug === undefined ? {} : { link: `${origin}/l/${slug}` }),
                copy: buildProgramCopy({ t }),
            }}
            on={buildProgramCommands({ form, touch, values, submit })}
        />
    )
}
/** Builds the LoyaltyProgramSettingsContent section from the current view. */
const buildProgramCopy = ({ t }: BuildProgramCopyContext) =>
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
/** Builds the LoyaltyProgramSettingsContent section from the current view. */
const buildProgramCommands = ({ form, touch, values, submit }: BuildProgramCommandsContext) =>
    ({
        change: (field: import("@/hooks/loyaltyProgramFields").ProgramTextField, value: string) =>
            form.setValue(field, maskProgramField(field, value), touch),
        toggle: (field: import("@/hooks/loyaltyProgramFields").ProgramSwitchField, value: boolean) =>
            form.setValue(field, value, touch),
        changeTier: (uid: string, field: import("@/hooks/loyaltyProgramFields").TierTextField, value: string) =>
            form.setValue(
                "tiers",
                values.tiers.map((tier) =>
                    tier.uid === uid ? { ...tier, [field]: maskTierField(field, value) } : tier,
                ),
                touch,
            ),
        removeTier: (uid: string) =>
            form.setValue(
                "tiers",
                values.tiers.filter((tier) => tier.uid !== uid),
                touch,
            ),
        addTier: () => form.setValue("tiers", [...values.tiers, blankTier()], touch),
        changeCategory: (uid: string, field: import("@/hooks/loyaltyProgramFields").CategoryTextField, value: string) =>
            form.setValue(
                "categories",
                values.categories.map((category) =>
                    category.uid === uid ? { ...category, [field]: maskCategoryField(field, value) } : category,
                ),
                touch,
            ),
        removeCategory: (uid: string) =>
            form.setValue(
                "categories",
                values.categories.filter((category) => category.uid !== uid),
                touch,
            ),
        addCategory: () => form.setValue("categories", [...values.categories, blankCategory()], touch),
        submit: () => void submit(),
    }) as const
