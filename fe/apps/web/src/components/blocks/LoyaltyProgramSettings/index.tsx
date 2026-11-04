"use client"

import { useTranslations } from "next-intl"
import {
    BLANK_PROGRAM,
    MAX_CATEGORIES,
    MAX_TIERS,
    blankCategory,
    blankTier,
    programValuesOf,
    programCopyOf,
    useLoyaltyProgramSave,
    useSiteOrigin,
} from "@/hooks/loyaltyProgram"
import { maskCategoryField, maskProgramField, maskTierField } from "@/hooks/loyaltyProgramFields"
import { useLoyaltyProgramForm } from "@/hooks/rhf"
import { slotOfSwr, useSlotLabels } from "@/hooks/slot"
import { useQueryLoyaltyBoardSwr, useQueryLoyaltyProgramSwr } from "@/hooks/swr"
import type {
    CategoryTextField,
    ProgramSwitchField,
    ProgramTextField,
    ProgramValues,
    TierTextField,
} from "@/modules/types"
import { LoyaltyProgramSettingsBase } from "./component"

/** Inputs needed to build the programme commands. */
interface BuildProgramCommandsContext {
    readonly form: ReturnType<typeof useLoyaltyProgramForm>
    readonly touch: { shouldDirty: boolean; shouldValidate: boolean }
    readonly values: ProgramValues
    readonly submit: (e?: React.BaseSyntheticEvent) => Promise<void>
    readonly retry: () => void
}

/** The connected programme form: the whole programme in one form with one save (outcome toasted). */
export const LoyaltyProgramSettings = () => {
    const t = useTranslations("loyalty")
    const program = useQueryLoyaltyProgramSwr()
    const { data } = program
    const slotLabels = useSlotLabels()
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
                slot: slotOfSwr({
                    data: data === undefined ? undefined : (true as const),
                    error: program.error,
                    isLoading: program.isLoading,
                }),
                slotLabels: { ...slotLabels(t("programFailed")), error: t("programFailed") },
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
                copy: programCopyOf(t),
            }}
            on={buildProgramCommands({
                form,
                touch,
                values,
                submit,
                retry: () => {
                    void program.mutate()
                },
            })}
        />
    )
}
/** Builds the LoyaltyProgramSettingsContent section from the current view. */
const buildProgramCommands = ({ form, touch, values, submit, retry }: BuildProgramCommandsContext) =>
    ({
        change: (field: ProgramTextField, value: string) => form.setValue(field, maskProgramField(field, value), touch),
        toggle: (field: ProgramSwitchField, value: boolean) => form.setValue(field, value, touch),
        changeTier: (uid: string, field: TierTextField, value: string) =>
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
        changeCategory: (uid: string, field: CategoryTextField, value: string) =>
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
        retry,
    }) as const
