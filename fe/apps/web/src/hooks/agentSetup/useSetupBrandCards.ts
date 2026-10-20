"use client"

import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { useBrandKitForm } from "@/hooks/rhf"
import { brandCardOf, kitOfText, kitTextOf, type BrandCardSay, type BrandKitText } from "@/modules/content"
import { useSetupBrandKit } from "./useSetupBrandKit"

const EMPTY_TEXT: BrandKitText = { brandName: "", colors: "", fonts: "", tone: "", address: "", imagery: "", avoid: "" }

const useBrandCardSay = (): BrandCardSay => {
    const t = useTranslations("marketing")
    return useMemo(
        () => ({
            labels: {
                brandName: t("brandName"),
                colors: t("colors"),
                fonts: t("fonts"),
                tone: t("tone"),
                address: t("address"),
                imagery: t("imagery"),
                avoid: t("avoid"),
            },
            none: t("none"),
            colorsHint: t("colorsHint"),
            head: (brand, name) => t("brandHead", { brand, name }),
            decidedLine: (status, name) =>
                status === "applied" ? t("brandAppliedLine", { name }) : t("brandRejectedLine", { name }),
            status: (status) => {
                if (status === "applied") return t("statusApplied")
                if (status === "rejected") return t("statusRejected")
                return t("statusProposed")
            },
            confirm: t("confirm"),
            edit: t("edit"),
            closeEdit: t("closeEdit"),
            reject: t("reject"),
        }),
        [t],
    )
}

/** The brand guideline part of the setup chat (the AI Marketing agent only): the PDF dropzone, the brand proposal cards with
 * their one open edit, and the commands that confirm (edited or not) or reject a proposal. Null content for other agents. */
export const useSetupBrandCards = (
    installationId: string,
    setupSessionId: string,
    isEnabled: boolean,
    onRead: () => void,
) => {
    const t = useTranslations("marketing")
    const say = useBrandCardSay()
    const brand = useSetupBrandKit({ installationId, setupSessionId, isEnabled, onRead })
    const [editingId, setEditingId] = useState("")
    const form = useBrandKitForm(EMPTY_TEXT)
    const fields = form.watch()
    const error = Object.values(form.formState.errors).find((field) => field?.message)?.message ?? ""
    const cards = brand.proposals.map((proposal) =>
        brandCardOf(proposal, say, {
            isEditing: proposal.id === editingId,
            fields: proposal.id === editingId ? fields : kitTextOf(proposal.kit),
            error: proposal.id === editingId ? error : "",
            isPending: brand.decidingId === proposal.id || (proposal.id === editingId && form.formState.isSubmitting),
        }),
    )
    const toggleEdit = (id: string) => {
        const proposal = brand.proposals.find((entry) => entry.id === id)
        if (proposal === undefined || id === editingId) {
            setEditingId("")
            return
        }
        form.reset(kitTextOf(proposal.kit))
        setEditingId(id)
    }
    const confirm = (id: string) => {
        if (id !== editingId) {
            void brand.decide(id, "confirm")
            return
        }
        void form.handleSubmit(async (text) => {
            if (await brand.decide(id, "confirm", kitOfText(text))) setEditingId("")
        })()
    }
    return {
        content: isEnabled
            ? {
                  attachLabel: t("attachLabel"),
                  attachPrompt: t("attachPrompt"),
                  isReading: brand.isReading,
                  readingLabel: t("reading"),
                  cards,
              }
            : null,
        scrollKey: `${brand.proposals.length}:${brand.isReading}`,
        on: {
            attach: (files: ReadonlyArray<File>) => void brand.attach(files),
            brandField: (name: keyof BrandKitText, value: string) => form.setValue(name, value),
            brandConfirm: confirm,
            brandToggleEdit: toggleEdit,
            brandReject: (id: string) => void brand.decide(id, "reject"),
        },
    }
}
