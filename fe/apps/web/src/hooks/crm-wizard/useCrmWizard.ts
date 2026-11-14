"use client"

import { useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { useSettledGraphQL } from "@/hooks/connection-wizard"
import { useConnectionsRefresh } from "@/hooks/connections"
import { useMutateSaveCrmConnectionSwr, useQueryCrmConnectionSwr, useQueryCrmTemplatesSwr } from "@/hooks/swr"
import type { SlotRead } from "@/hooks/slot"
import {
    CRM_OTHER,
    CRM_REFUSAL_CODE,
    type CrmAuthType,
    type CrmSaved,
    type CrmTemplate,
} from "@/modules/crm"
import { CRM_STEPS, formOfView, isFormReady, type CrmForm, type CrmWizardStep } from "./crm-wizard.shared"

/** What the CRM wizard needs from its drawer. */
interface CrmWizardInput {
    /** Edit this saved CRM connection instead of creating a new one. */
    readonly resumeId: string | undefined
    /** `changed` is true when something was saved, so the list refreshes. */
    readonly onClose: (changed: boolean) => void
}

/** The commands the view calls. */
interface CrmWizardCommands {
    readonly pick: (id: string) => void
    readonly crmId: (value: string) => void
    readonly baseUrl: (value: string) => void
    readonly swaggerUrl: (value: string) => void
    readonly authType: (value: string | null) => void
    readonly authName: (value: string) => void
    readonly secret: (value: string) => void
    readonly go: (to: number) => void
    readonly save: () => void
    readonly close: () => void
    readonly finish: () => void
}

/** What the CRM wizard draws and does. */
interface CrmWizardResult {
    /** The reads the drawer waits for: the templates, and the saved connection when it is edited. */
    readonly reads: ReadonlyArray<SlotRead<unknown>>
    readonly index: number
    readonly step: CrmWizardStep
    readonly templates: ReadonlyArray<CrmTemplate>
    /** The row picked: a template's id, `other`, or null before a pick. */
    readonly picked: string | null
    /** The template picked, when one is. */
    readonly template: CrmTemplate | undefined
    /** The form as the shop sees it: a template's id, auth type and header name are fixed. */
    readonly form: CrmForm
    /** A key is already stored: the field may stay empty. */
    readonly hasSecret: boolean
    readonly canPick: boolean
    readonly canSave: boolean
    readonly result: CrmSaved | null
    readonly error: string | null
    readonly isPending: boolean
    readonly on: CrmWizardCommands
}

/** The pick a resumed connection starts on: its own template when the list holds it, else the "other CRM" row; none for a new one. */
const resumedPickOf = (resumedId: string | undefined, list: ReadonlyArray<CrmTemplate>): string | null => {
    if (resumedId === undefined) return null
    return list.some((item) => item.id === resumedId) ? resumedId : CRM_OTHER
}

/** The auth type a select value stands for. */
const authTypeOf = (value: string | null): CrmAuthType => (value === "header" ? "header" : "bearer")

/**
 * The CRM connect wizard's state machine (CRM provider via OpenAPI): pick a CRM a package declares, or "other"; the address and the
 * key (write-only; empty keeps the stored one); then what the live Swagger came to. Saving fetches and pins the live document.
 */
export const useCrmWizard = (input: CrmWizardInput): CrmWizardResult => {
    const t = useTranslations("connectorCrm")
    const settle = useSettledGraphQL()
    const refresh = useConnectionsRefresh()
    const templates = useQueryCrmTemplatesSwr()
    const stored = useQueryCrmConnectionSwr(input.resumeId)
    const { trigger } = useMutateSaveCrmConnectionSwr()
    const [index, setIndex] = useState(input.resumeId === undefined ? 0 : 1)
    const [chosen, setChosen] = useState<string | null>(null)
    const [edits, setEdits] = useState<Partial<CrmForm>>({})
    const [savedId, setSavedId] = useState<string | null>(null)
    const [result, setResult] = useState<CrmSaved | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    const list = templates.data ?? []
    const resumedId = stored.data?.crmId
    const picked = chosen ?? resumedPickOf(resumedId, list)
    const template = list.find((item) => item.id === picked)
    const typed = { ...formOfView(stored.data), ...edits }
    const form: CrmForm =
        template === undefined
            ? typed
            : { ...typed, crmId: template.id, authType: template.authType === "header" ? "header" : "bearer", authName: template.authName }
    const connectionId = input.resumeId ?? savedId
    const hasSecret = (stored.data?.hasSecret ?? false) || result !== null

    const edit = (patch: Partial<CrmForm>): void => setEdits((current) => ({ ...current, ...patch }))

    const messageOf = (message: string, code: string | undefined): string =>
        code === CRM_REFUSAL_CODE && t.has(`detail_${message}`) ? t(`detail_${message}`) : message

    const save = (): void =>
        startTransition(async () => {
            setError(null)
            const settled = await settle(() =>
                trigger({
                    ...(connectionId === null ? {} : { connectionId }),
                    crmId: form.crmId.trim(),
                    baseUrl: form.baseUrl.trim(),
                    ...(template === undefined ? { swaggerUrl: form.swaggerUrl.trim() } : {}),
                    auth: {
                        type: form.authType,
                        ...(form.authType === "header" ? { name: form.authName.trim() } : {}),
                        value: form.secret,
                    },
                }),
            )
            if (settled.kind === "failed") return setError(messageOf(settled.message, settled.code))
            setResult(settled.value)
            setSavedId(settled.value.connectionId)
            edit({ secret: "" })
            setIndex(2)
            await refresh()
        })

    return {
        reads: input.resumeId === undefined ? [templates] : [templates, stored],
        index,
        step: CRM_STEPS[index] ?? "pick",
        templates: list,
        picked,
        template,
        form,
        hasSecret,
        canPick: picked !== null,
        canSave: isFormReady(form, template, hasSecret),
        result,
        error,
        isPending,
        on: {
            pick: (id) => {
                setChosen(id)
                setEdits({})
            },
            crmId: (value) => edit({ crmId: value }),
            baseUrl: (value) => edit({ baseUrl: value }),
            swaggerUrl: (value) => edit({ swaggerUrl: value }),
            authType: (value) => edit({ authType: authTypeOf(value) }),
            authName: (value) => edit({ authName: value }),
            secret: (value) => edit({ secret: value }),
            go: (to) => {
                setError(null)
                setIndex(to)
            },
            save,
            close: () => input.onClose(result !== null),
            finish: () => input.onClose(true),
        },
    }
}
