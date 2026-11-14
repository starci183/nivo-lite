"use client"

import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { GUIDE_ENTRIES, guideKeyOf, indexKeyOf, pagesFor, type GuideDoc, type GuideSignals } from "@/modules/guide"
import { stringsOf } from "./guide.shared"
import type { GuideGrantable } from "./useGuideData"

/** How many steps of a guide the row shows. */
const STEPS_SHOWN = 3

/**
 * Every document the search runs over: the static index (routes, tabs, actions) and the step guides of the site map in the reader's
 * language, plus the actions the workspace's own state makes possible (give this account to that agent, give an agent its first
 * connection). Staff never see a manager-only entry.
 */
export const useGuideDocs = (
    isManager: boolean,
    signals: GuideSignals,
    grantable: ReadonlyArray<GuideGrantable>,
): ReadonlyArray<GuideDoc> => {
    const index = useTranslations("guideIndex")
    const map = useTranslations("guideMap")
    const copy = useTranslations("guide")
    return useMemo(() => {
        const entries = GUIDE_ENTRIES.filter((entry) => isManager || entry.managerOnly !== true).map(
            (entry): GuideDoc => {
                const key = indexKeyOf(entry.id)
                return {
                    id: entry.id,
                    group: entry.group,
                    kind: entry.kind,
                    title: index(`${key}.title`),
                    hint: index(`${key}.hint`),
                    keywords: stringsOf(index.raw(`${key}.keywords`)),
                    href: entry.href,
                    ...(entry.target === undefined ? {} : { target: entry.target }),
                }
            },
        )
        const guides = pagesFor(isManager)
            .map((page): GuideDoc | null => {
                const key = guideKeyOf(page.id)
                const steps = stringsOf(map.raw(`${key}.steps`))
                if (steps.length === 0) return null
                return {
                    id: `guide.${page.id}`,
                    group: "guide",
                    kind: "guide",
                    title: map(`${key}.title`),
                    hint: steps.slice(0, STEPS_SHOWN).join(" / "),
                    keywords: [...stringsOf(map.raw(`${key}.keywords`)), map(`${key}.what`)],
                    href: page.path,
                    ...(page.target === undefined ? {} : { target: page.target }),
                }
            })
            .filter((doc): doc is GuideDoc => doc !== null)
        const grants = isManager
            ? grantable.map(
                  (one): GuideDoc => ({
                      id: `grant.${one.id}`,
                      group: "do",
                      kind: "action",
                      title: copy("doGrant", { connection: one.connection, agent: one.agent }),
                      hint: copy("doGrantHint"),
                      keywords: [one.connection, one.agent],
                      href: one.href,
                      target: "agent.grant",
                  }),
              )
            : []
        const firsts = isManager
            ? signals.agentsWithoutConnection.map(
                  (one): GuideDoc => ({
                      id: `first.${one.id}`,
                      group: "do",
                      kind: "action",
                      title: copy("todo.grantConnection", { name: one.name }),
                      hint: copy("doGrantHint"),
                      keywords: [one.name],
                      href: one.href,
                      target: "agent.grant",
                  }),
              )
            : []
        return [...entries, ...grants, ...firsts, ...guides]
    }, [isManager, signals.agentsWithoutConnection, grantable, index, map, copy])
}
