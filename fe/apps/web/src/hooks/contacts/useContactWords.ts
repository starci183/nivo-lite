"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useMemo } from "react"
import type { ContactWords } from "@/modules/types"
import type { ContactNames } from "./useContactNames"

/** A moment that is closer than this to now reads "just now". */
const JUST_NOW_MS = 60_000

/** The ways a piece of work ends that the page has a word for, by the status the back end answers (the data holds no other). */
const NOTE_STATUS_KEYS: Readonly<Record<string, "noteDone" | "noteFailed" | "notePassedOver">> = {
    done: "noteDone",
    failed: "noteFailed",
    passed_over: "notePassedOver",
}

/** The words the mapping of a person is worded with: kinds, proofs, merge reasons, names of accounts, how work ended, who holds a conversation, and the time a moment ago. */
export const useContactWords = (names: ContactNames): ContactWords => {
    const t = useTranslations("contacts")
    const format = useFormatter()
    const now = useMemo(() => new Date(), [])
    return useMemo(
        () => ({
            unknownPerson: (brand) => (brand === null ? t("unknownNone") : t("unknownBrand", { brand })),
            ago: (iso) => {
                const at = new Date(iso)
                return now.getTime() - at.getTime() < JUST_NOW_MS ? t("justNow") : format.relativeTime(at, now)
            },
            kindPhone: t("kindPhone"),
            kindEmail: t("kindEmail"),
            kindChannel: t("kindChannel"),
            kindExternal: t("kindExternal"),
            proof: {
                channel: t("proofChannel"),
                token: t("proofToken"),
                member: t("proofMember"),
                claimed: t("proofClaimed"),
                verified: t("proofVerified"),
            },
            reason: {
                phone_verified: t("reasonPhone"),
                email_verified: t("reasonEmail"),
                link_token: t("reasonLink"),
                member_approved: t("reasonApproved"),
            },
            whyClaimed: t("whyClaimed"),
            whySameName: t("whySameName"),
            account: names.account,
            noteStatus: (status) => {
                const key = NOTE_STATUS_KEYS[status]
                return key === undefined ? null : t(key)
            },
            noteUnknownWork: t("noteUnknownWork"),
            noteRound: (round) => t("noteRound", { round }),
            hold: (name) => (name === null ? t("holdStaff") : t("holdBy", { name })),
        }),
        [t, format, now, names],
    )
}
