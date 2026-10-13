"use client"

import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { sameValue } from "@/lib/brain/shared"
import type { Scope } from "@/lib/brain/shared"
import type { RuleMode } from "@/lib/flow-types"
import type { FactWrite, Resolution, RuleWrite, WriteDecision } from "@/lib/module-setup-writes"
import { MODULE_REGISTRY, actionDef, pickCopy } from "@/modules/catalog"
import { SetupWriteCardBase } from "./component"

/** The module whose chat this is, when its type allows several instances (one Chatbot per branch): a fact may be kept for this instance only. */
type SetupWriteInstance = { readonly name: string; readonly typeName: string }

type SetupWriteCardProps = {
    readonly write: FactWrite | RuleWrite
    /** Sends the decision of the owner; resolves to the reason it failed, empty when it worked. */
    readonly onDecide: (id: string, change: WriteDecision) => Promise<string>
    readonly instance: SetupWriteInstance | null
}

/** What the owner has edited on a card so far. */
type Draft = {
    readonly isEditing: boolean
    readonly value: string
    readonly scope: Scope
    readonly mode: RuleMode
    readonly limit: number | null
    readonly resolution: Resolution
    readonly situation: string
    /** Shared by every instance of the type unless the owner keeps it for this one. */
    readonly onlyThis: boolean
}

const MODES: ReadonlyArray<RuleMode> = ["auto", "ask", "never"]
const RESOLUTIONS: ReadonlyArray<Resolution> = ["replace", "keep", "both"]
const SCOPES: ReadonlyArray<Scope> = ["public", "internal", "restricted"]
const SCOPE_KEY = { public: "wScopePublic", internal: "wScopeInternal", restricted: "wScopeRestricted" } as const
const FOR_ALL = "all"
const FOR_THIS = "this"

const startOf = (write: FactWrite | RuleWrite): Draft => ({
    isEditing: false,
    value: write.kind === "fact" ? write.payload.value : "",
    scope: write.kind === "fact" ? write.payload.scope : "internal",
    mode: write.kind === "rule" ? write.payload.mode : "ask",
    limit: write.kind === "rule" ? write.payload.limitVnd : null,
    resolution: "replace",
    situation: "",
    onlyThis: false,
})

/** One proposed write of the setup chat. The owner confirms (edited or not) before anything is written. */
export const SetupWriteCard = (props: SetupWriteCardProps) => {
    const t = useTranslations("moduleSetup")
    const locale = useLocale() === "en" ? "en" : "vi"
    const { write, instance } = props
    const [draft, setDraft] = useState<Draft>(startOf(write))
    const [error, setError] = useState("")
    const [isPending, setPending] = useState(false)
    const patch = (change: Partial<Draft>) => setDraft((current) => ({ ...current, ...change }))
    const def = write.kind === "rule" ? actionDef(write.payload.action) : null
    const money = (n: number | null): string =>
        n === null
            ? t("wLimitNone")
            : new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-GB", {
                  style: "currency",
                  currency: "VND",
                  maximumFractionDigits: 0,
              }).format(n)
    const modeLabel = (mode: RuleMode): string => t(`mode_${mode}`)
    const decide = async (change: WriteDecision) => {
        setPending(true)
        setError("")
        setError(await props.onDecide(write.id, change))
        setPending(false)
    }

    const decided = ((): { line: string; label: string; tone: "success" | "neutral" } | null => {
        if (write.status === "proposed") return null
        const line =
            write.kind === "fact"
                ? `${write.payload.subjectLabel} · ${write.payload.attributeLabel}: ${write.payload.value}`
                : `${pickCopy(actionDef(write.payload.action).label, locale)} · ${modeLabel(write.payload.mode)}${
                      actionDef(write.payload.action).amountLimit ? ` · ${money(write.payload.limitVnd)}` : ""
                  }`
        const rejected = write.status === "rejected"
        const label = rejected
            ? write.result?.resolution === "keep"
                ? t("wKept")
                : t("wRejected")
            : write.kind === "fact"
              ? t("wApplied")
              : t("wAppliedRule")
        return { line, label, tone: write.status === "applied" ? "success" : "neutral" }
    })()

    // The value in force is the shared one: a value kept for this instance only sits beside it and never conflicts with it.
    const isConflict =
        write.kind === "fact" &&
        !draft.onlyThis &&
        write.current !== null &&
        !sameValue(write.current.value, draft.value)
    const forLabel =
        instance === null
            ? ""
            : draft.onlyThis
              ? t("wForThis", { name: instance.name })
              : t("wForAll", { type: instance.typeName })
    const items =
        write.kind === "fact"
            ? [
                  { id: "subject", term: t("wSubject"), description: write.payload.subjectLabel },
                  { id: "attribute", term: t("wAttribute"), description: write.payload.attributeLabel },
                  ...(draft.isEditing ? [] : [{ id: "value", term: t("wValue"), description: draft.value }]),
                  ...(draft.isEditing
                      ? []
                      : [{ id: "scope", term: t("wScope"), description: t(SCOPE_KEY[draft.scope]) }]),
                  ...(draft.isEditing || instance === null
                      ? []
                      : [{ id: "for", term: t("wFor"), description: forLabel }]),
              ]
            : [
                  {
                      id: "action",
                      term: t("wAction"),
                      description: pickCopy(actionDef(write.payload.action).label, locale),
                  },
                  ...(draft.isEditing ? [] : [{ id: "mode", term: t("wMode"), description: modeLabel(draft.mode) }]),
                  ...(draft.isEditing || !def?.amountLimit
                      ? []
                      : [{ id: "limit", term: t("wLimit"), description: money(draft.limit) }]),
                  {
                      id: "now",
                      term: t("wNow"),
                      description: write.current
                          ? `${modeLabel(write.current.mode)}${def?.amountLimit ? ` · ${money(write.current.limitVnd)}` : ""}`
                          : t("wNowNone"),
                  },
              ]
    const confirm = () => {
        if (write.kind === "fact") {
            void decide({
                decision: "confirm",
                fact: { value: draft.value, scope: draft.scope },
                resolution: isConflict ? draft.resolution : undefined,
                situation: draft.resolution === "both" ? draft.situation : undefined,
                onlyThisAgent: instance !== null && draft.onlyThis,
            })
        } else {
            void decide({
                decision: "confirm",
                rule: { mode: draft.mode, limitVnd: def?.amountLimit ? draft.limit : null },
            })
        }
    }
    return (
        <SetupWriteCardBase
            props={{
                decided,
                proposal: {
                    id: write.id,
                    head: write.kind === "fact" ? t("wFactTitle") : t("wRuleTitle"),
                    isFact: write.kind === "fact",
                    hasGap: write.kind === "fact" && Boolean(write.payload.gapId),
                    gapLabel: t("wGap"),
                    items,
                    sharedNote:
                        write.kind === "rule" && instance !== null ? t("wRuleShared", { type: instance.typeName }) : "",
                    isEditing: draft.isEditing,
                    valueLabel: t("wValue"),
                    value: draft.value,
                    scopeLabel: t("wScope"),
                    scope: draft.scope,
                    scopeOptions: SCOPES.map((scope) => ({ value: scope, label: t(SCOPE_KEY[scope]) })),
                    forLabel: t("wFor"),
                    forValue: draft.onlyThis ? FOR_THIS : FOR_ALL,
                    forOptions:
                        instance === null
                            ? []
                            : [
                                  { value: FOR_ALL, label: t("wForAll", { type: instance.typeName }) },
                                  { value: FOR_THIS, label: t("wForThis", { name: instance.name }) },
                              ],
                    modeLabel: t("wMode"),
                    mode: draft.mode,
                    modeOptions: MODES.filter((mode) => mode !== "auto" || def?.maxMode === null).map((mode) => ({
                        value: mode,
                        label: modeLabel(mode),
                    })),
                    hasLimit: def?.amountLimit === true,
                    limitLabel: t("wLimit"),
                    limit: draft.limit ?? undefined,
                    isLimitDisabled: draft.mode === "never",
                    isConflict,
                    conflictTitle: t("wConflictTitle"),
                    conflictBody: t("wConflictBody", {
                        current: write.kind === "fact" ? (write.current?.value ?? "") : "",
                    }),
                    resolution: draft.resolution,
                    resolutionOptions: RESOLUTIONS.map((resolution) => ({
                        value: resolution,
                        label: t(resolution === "replace" ? "wReplace" : resolution === "keep" ? "wKeep" : "wBoth"),
                    })),
                    situationLabel: t("wSituation"),
                    situation: draft.situation,
                    errorTitle: t("wError"),
                    error,
                    confirmLabel: t("wConfirm"),
                    editLabel: draft.isEditing ? t("wEditDone") : t("wEdit"),
                    rejectLabel: t("wReject"),
                    canConfirm:
                        write.kind === "rule" ||
                        (draft.value.trim().length > 0 &&
                            (draft.resolution !== "both" || !isConflict || draft.situation.trim().length > 0)),
                    isPending,
                },
            }}
            on={{
                value: (value) => patch({ value }),
                scope: (value) => patch({ scope: SCOPES.find((scope) => scope === value) ?? "internal" }),
                forWho: (value) => patch({ onlyThis: value === FOR_THIS }),
                mode: (value) => patch({ mode: MODES.find((mode) => mode === value) ?? "ask" }),
                limit: (value) => patch({ limit: Number.isFinite(value) ? value : null }),
                resolution: (value) =>
                    patch({ resolution: RESOLUTIONS.find((resolution) => resolution === value) ?? "replace" }),
                situation: (situation) => patch({ situation }),
                confirm,
                toggleEdit: () => patch({ isEditing: !draft.isEditing }),
                reject: () => void decide({ decision: "reject" }),
            }}
        />
    )
}
