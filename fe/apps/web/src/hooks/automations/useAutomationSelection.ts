"use client"

import { useEffect, useState } from "react"
import { automationStatusOf, startsAutomationConnection } from "@/modules/automations"
import type { AutomationStatus } from "@/modules/automations"
import type { AutomationCardView } from "@/modules/types"
import type { AutomationPatch } from "./automations.shared"
import { useAutomationDetail } from "./useAutomationDetail"

interface AutomationSelectionInput {
    readonly focus: string | null
    readonly cards: ReadonlyArray<AutomationCardView>
    readonly visible: ReadonlyArray<AutomationCardView>
    readonly change: (key: string, patch: AutomationPatch) => Promise<boolean>
    readonly connect: (card: AutomationCardView, status: AutomationStatus) => Promise<void>
}

/** Owns selection and editing of the open automation while the board owns its data and navigation. */
export const useAutomationSelection = (input: AutomationSelectionInput) => {
    const { cards, visible, change, connect } = input
    const [selected, setSelected] = useState<string | null>(input.focus)
    const [awaiting, setAwaiting] = useState<string | null>(null)
    const current = visible.find((card) => card.key === selected) ?? null
    const detail = useAutomationDetail(current)

    useEffect(() => {
        if (selected)
            document.getElementById("automation-detail")?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }, [selected])

    const open = (card: AutomationCardView) => {
        setSelected(card.key)
        if (card.body === null && card.def.defaultBody !== null) detail.compose(card.key)
    }

    const select = (key: string) => {
        setAwaiting(null)
        const card = cards.find((candidate) => candidate.key === key)
        if (selected === key || card === undefined) return setSelected(null)
        open(card)
    }

    const toggle = (key: string, next: boolean) => {
        const card = cards.find((candidate) => candidate.key === key)
        if (card === undefined) return
        const status = automationStatusOf(card)
        if (startsAutomationConnection(status)) return void connect(card, status)
        if (next && card.def.defaultBody && card.body === null) {
            open(card)
            return setAwaiting(card.key)
        }
        void change(card.key, { enabled: next })
    }

    const saveBody = async (): Promise<boolean> =>
        current === null ? false : change(current.key, { body: detail.form.body })

    const enable = async () => {
        if (current === null || !(await saveBody())) return
        setAwaiting(null)
        await change(current.key, { enabled: true })
    }

    const saveSettings = async () => {
        if (current === null) return
        detail.markSaved(await change(current.key, { values: detail.form.values }))
    }

    return { selected, awaiting, current, detail, select, toggle, saveBody, enable, saveSettings, setSelected }
}
