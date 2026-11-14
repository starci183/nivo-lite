import { useTranslations } from "next-intl"
import { useMemo } from "react"
import {
    GROUP_WORDS,
    KIND_ICONS,
    KIND_WORDS,
    pageDocAt,
    useGuideConversation,
    useGuideData,
    useGuideDocs,
    useGuideGo,
    useGuideSearch,
} from "@/hooks/guide"
import { isManager, useMember } from "@/hooks/member"
import { navigation } from "@/modules/i18n"
import { pathInWorkspace } from "@/modules/routes"
import { GUIDE_GROUPS, firstHit, todosFor, type GuideDoc, type GuideHit } from "@/modules/guide"
import { GuideDrawerBase } from "./drawer"
import type { GuideGroupView, GuideRowView } from "./types"

/** The face of the guide, in the public folder. */
export const GUIDE_IMAGE = "/nivo-ai.png"

/** The chips and the entry each one goes straight to. */
const CHIPS: ReadonlyArray<{ readonly id: string; readonly word: string }> = [
    { id: "action.addSepay", word: "chipMoney" },
    { id: "action.addTelegram", word: "chipBot" },
    { id: "action.inviteMember", word: "chipStaff" },
    { id: "action.uploadDocument", word: "chipPrices" },
]

interface GuideDrawerProps {
    readonly isOpen: boolean
    readonly toggle: () => void
    readonly close: () => void
}

/**
 * The connected drawer of the guide. It mounts when the guide is first opened, which is when the workspace's things are read (once);
 * from then on every key only ranks what was read. Nothing here calls the model unless the member asks it, after a search found nothing.
 */
export const GuideDrawer = (props: GuideDrawerProps) => {
    const t = useTranslations("guide")
    const manager = isManager(useMember())
    const pathname = navigation.usePathname()
    const path = pathInWorkspace(pathname)
    const data = useGuideData()
    const staticDocs = useGuideDocs(manager, data.signals, data.grantable)
    const docs = useMemo(() => [...staticDocs, ...data.docs], [staticDocs, data.docs])
    const search = useGuideSearch(docs)
    const conversation = useGuideConversation(manager)
    const go = useGuideGo(path, props.close)
    const todos = todosFor(path, data.signals)
    const todoDocs = useMemo(() => new Map(todos.map((todo) => [`todo.${todo.id}`, todo])), [todos])
    const byId = useMemo(() => new Map(docs.map((doc) => [doc.id, doc])), [docs])
    const page = pageDocAt(path, docs)

    const rowOf = (doc: GuideDoc): GuideRowView => ({
        id: doc.id,
        title: doc.title,
        description: doc.hint,
        icon: KIND_ICONS[doc.kind],
        meta: t(KIND_WORDS[doc.kind]),
    })
    const groups: ReadonlyArray<GuideGroupView> = GUIDE_GROUPS.flatMap((group) => {
        const hits: ReadonlyArray<GuideHit> = search.results[group] ?? []
        return hits.length === 0 ? [] : [{ id: group, title: t(GROUP_WORDS[group]), rows: hits.map((hit) => rowOf(hit.doc)) }]
    })
    const todoRows: ReadonlyArray<GuideRowView> = todos.map((todo) => ({
        id: `todo.${todo.id}`,
        title: t(`todo.${todo.key}`, todo.values),
        icon: "goal",
    }))
    const openDoc = (id: string) => {
        const todo = todoDocs.get(id)
        if (todo !== undefined) {
            go({
                id,
                group: "do",
                kind: "action",
                title: t(`todo.${todo.key}`, todo.values),
                hint: "",
                keywords: [],
                href: todo.href,
                ...(todo.target === undefined ? {} : { target: todo.target }),
            })
            return
        }
        const doc = byId.get(id)
        if (doc !== undefined) go(doc)
    }
    const hereOf = (): string => {
        if (page === undefined) return t("hereUnknown")
        if (todos.length === 0) return t("hereNone", { page: page.title })
        return t("here", { page: page.title, count: todos.length })
    }
    const here = hereOf()

    return (
        <GuideDrawerBase
            props={{
                isOpen: props.isOpen,
                title: t("title"),
                subtitle: t("subtitle"),
                closeLabel: t("close"),
                imageSrc: GUIDE_IMAGE,
                shortcutKeys: [isMac() ? "command" : "Ctrl", "K"],
                here: { text: here, title: t("groupDo"), todos: todoRows },
                chips: CHIPS.filter((chip) => byId.has(chip.id)).map((chip) => ({ id: chip.id, label: t(chip.word) })),
                query: search.query,
                questionLabel: t("questionLabel"),
                placeholder: t("placeholder"),
                clearLabel: t("clear"),
                isSearching: search.isSearching,
                groups,
                noResults:
                    search.isSearching && search.count === 0
                        ? { text: t("noResults", { query: search.query.trim() }), askLabel: t("askAi") }
                        : null,
                messages: conversation.messages.map((message) =>
                    message.role === "user"
                        ? { id: message.id, isUser: true, text: message.text, steps: [], links: [], note: null }
                        : {
                              id: message.id,
                              isUser: false,
                              text: message.reply.answer,
                              steps: message.reply.steps,
                              links: message.reply.links.map((link) => ({ id: link.pageId, label: link.label })),
                              note: message.reply.source === "ai" ? t("aiNote") : null,
                          },
                ),
                isThinking: conversation.isAsking,
                thinking: t("thinking"),
                stepsLabel: t("steps"),
                emptyLabel: t("hereUnknown"),
                restartLabel: t("restart"),
            }}
            on={{
                toggle: props.toggle,
                changeQuery: search.setQuery,
                submit: () => {
                    const hit = firstHit(search.results)
                    if (hit !== undefined) go(hit.doc)
                },
                open: openDoc,
                chip: openDoc,
                ask: () => {
                    void conversation.ask(search.query, path)
                    search.setQuery("")
                },
                go: (messageId, linkId) => {
                    const message = conversation.messages.find((entry) => entry.id === messageId)
                    const link =
                        message?.role === "guide"
                            ? message.reply.links.find((entry) => entry.pageId === linkId)
                            : undefined
                    if (link === undefined) return
                    go({
                        id: link.pageId,
                        group: "guide",
                        kind: "guide",
                        title: link.label,
                        hint: "",
                        keywords: [],
                        href: link.href,
                        ...(link.target === undefined ? {} : { target: link.target }),
                    })
                },
                restart: () => {
                    conversation.restart()
                    search.setQuery("")
                },
            }}
        />
    )
}

/** Whether the person is on a Mac, where the chord is Command+K. */
const isMac = (): boolean => typeof navigator !== "undefined" && /mac/iu.test(navigator.platform)
