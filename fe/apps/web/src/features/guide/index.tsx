"use client"

import { useCallback, useEffect, useId, useRef, useState, useTransition, type CSSProperties, type FormEvent } from "react"
import { usePathname, useRouter } from "next/navigation"
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "framer-motion"
import { Button, ChatBubble, CloseButton, Form, IconButton, Input, List, ListItem, SurfaceCard, Text } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import { useLocale, useT } from "@/i18n/client"
import { guide as dict } from "@/i18n/dict/guide"
import { askGuide } from "@/lib/guide/actions"
import { pageAt } from "@/lib/guide/sitemap"
import type { GuideLink, GuideReply } from "@/lib/guide/types"
import { useGuideSpotlight, queueSpotlight } from "./spotlight"
import {
  ASK_INPUT_CLASS, ASK_ROW_CLASS, VIEWPORT_CLASS, BUBBLE_CLASS, FOOT_CLASS, LINKS_CLASS, MESSAGES_CLASS, PANEL_BODY_CLASS, PANEL_CLASS,
  PANEL_HEAD_CLASS, PANEL_HEAD_TEXT_CLASS, REPLY_CLASS, STEPS_CLASS, SUGGEST_CLASS,
} from "./classNames"

/** Props for {@link GuideBubble}. */
export type GuideBubbleProps = {
  /** Owners and managers see setup suggestions; staff see their own. */
  readonly isManager: boolean
}

type Msg = { readonly id: number; readonly role: "user"; readonly text: string } | { readonly id: number; readonly role: "guide"; readonly reply: GuideReply }
type Side = "left" | "right"

const SIZE = 56
const EDGE = 16
const TOP_RESERVE = 88
const BOTTOM_RESERVE = 96
/** On chat pages the composer and its suggestion row own the bottom band, so the bubble stays above them. */
const CHAT_BOTTOM_RESERVE = 232
const isChatPage = (pathname: string): boolean => pathname.startsWith("/chat") || /^\/modules\/[^/]+\/chat/.test(pathname)
const bottomReserve = (pathname: string): number => (isChatPage(pathname) ? CHAT_BOTTOM_RESERVE : BOTTOM_RESERVE)
const POS_KEY = "nivo.guide.position"
const MSG_KEY = "nivo.guide.messages"
const PANEL_W = 384
const GAP = 12
const PANEL_MAX_H = 576

const readJson = <T,>(storage: "local" | "session", key: string): T | null => {
  try {
    const raw = (storage === "local" ? window.localStorage : window.sessionStorage).getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}
const writeJson = (storage: "local" | "session", key: string, value: unknown) => {
  try {
    (storage === "local" ? window.localStorage : window.sessionStorage).setItem(key, JSON.stringify(value))
  } catch {
    // Private mode or blocked storage: the bubble simply starts at its default place next time.
  }
}
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi))
/** The left edge of the page content (past the sidebar rail on wide screens), so the bubble never sits on the menu. */
const contentLeft = (): number => Math.max(0, document.querySelector("main")?.getBoundingClientRect().left ?? 0)

/**
 * The NIVO guide: a round bubble on every console page that can be dragged anywhere and settles on the nearest side edge
 * (framer-motion), remembering where it was left. Pressing it opens a small chat that answers "where do I do X" and offers buttons
 * that open the page and highlight the place. The guide shows the way only; it never acts for the user.
 */
export const GuideBubble = ({ isManager }: GuideBubbleProps) => {
  const t = useT(dict)
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const reduce = useReducedMotion()
  const panelId = useId()
  const x = useMotionValue(-SIZE * 2)
  const y = useMotionValue(-SIZE * 2)
  const [side, setSide] = useState<Side>("right")
  const [top, setTop] = useState(0)
  const [ready, setReady] = useState(false)
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ReadonlyArray<Msg>>([])
  const [question, setQuestion] = useState("")
  const [isPending, startTransition] = useTransition()
  const dragged = useRef(false)
  const listRef = useRef<HTMLDivElement>(null)
  /** The viewport the bubble may be dragged within (a fixed, invisible layer; framer measures it). */
  const viewportRef = useRef<HTMLDivElement>(null)
  const sideRef = useRef<Side>("right")
  /** The height the member chose (as a share of the window), kept while pages with a taller bottom band push the bubble up. */
  const topRatio = useRef(1)
  const pathRef = useRef(pathname)
  pathRef.current = pathname
  useGuideSpotlight(pathname)

  /**
   * Settle on a side edge at a clamped height, animated unless the reader prefers less motion. `remember` stores the place as the
   * member's choice; a page change only re-clamps that choice (e.g. above the Office composer) without overwriting it.
   */
  const settle = useCallback((to: Side, wantTop: number, instant = false, remember = true) => {
    const w = window.innerWidth
    const h = window.innerHeight
    const nx = to === "right" ? w - SIZE - EDGE : contentLeft() + EDGE
    const ny = clamp(wantTop, TOP_RESERVE, h - SIZE - bottomReserve(pathRef.current))
    const spring = { type: "spring" as const, stiffness: 420, damping: 34 }
    if (instant || reduce) {
      x.set(nx)
      y.set(ny)
    } else {
      void animate(x, nx, spring)
      void animate(y, ny, spring)
    }
    sideRef.current = to
    setSide(to)
    setTop(ny)
    if (!remember) return
    topRatio.current = ny / h
    writeJson("local", POS_KEY, { side: to, top: ny / h })
  }, [reduce, x, y])
  const settleRef = useRef(settle)
  settleRef.current = settle

  // Once on mount: the remembered place (default bottom right). A resize keeps the chosen side and relative height.
  useEffect(() => {
    const saved = readJson<{ side: Side; top: number }>("local", POS_KEY)
    const h = window.innerHeight
    topRatio.current = saved ? saved.top : 1
    settleRef.current(saved?.side === "left" ? "left" : "right", topRatio.current * h, true, false)
    setMessages(readJson<ReadonlyArray<Msg>>("session", MSG_KEY) ?? [])
    setReady(true)
    const onResize = () => settleRef.current(sideRef.current, topRatio.current * window.innerHeight, true, false)
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  // Another page may reserve a taller bottom band (the Office composer): re-clamp the member's chosen height, animated.
  useEffect(() => {
    if (ready) settleRef.current(sideRef.current, topRatio.current * window.innerHeight, false, false)
  }, [pathname, ready])

  useEffect(() => {
    if (ready) writeJson("session", MSG_KEY, messages.slice(-20))
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: reduce ? "auto" : "smooth" })
  }, [messages, ready, reduce])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  const send = (text: string) => {
    const q = text.trim()
    if (!q || isPending) return
    const history = messages.map((m) => (m.role === "user" ? { role: "user" as const, text: m.text } : { role: "guide" as const, text: m.reply.answer }))
    const id = Date.now()
    setMessages((prev) => [...prev, { id, role: "user", text: q }])
    setQuestion("")
    startTransition(async () => {
      try {
        const reply = await askGuide({ question: q, path: pathname, history })
        setMessages((prev) => [...prev, { id: id + 1, role: "guide", reply }])
      } catch {
        setMessages((prev) => [...prev, { id: id + 1, role: "guide", reply: { answer: t("failed"), steps: [], links: [], source: "busy" } }])
      }
    })
  }

  const onSubmit = (_data: FormData, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    send(question)
  }

  const go = (link: GuideLink) => {
    if (link.target) queueSpotlight(link.target)
    if (window.innerWidth < 640) setOpen(false)
    if (pathname === link.href) window.dispatchEvent(new Event("nivo-guide-spotlight"))
    else router.push(link.href)
  }

  const here = pageAt(pathname)
  const suggestions = isManager
    ? [t("suggestSepay"), t("suggestTelegram"), t("suggestTeam"), t("suggestKnowledge")]
    : [t("suggestLeads"), t("suggestOffice"), t("suggestAccount")]
  const panelStyle = ((): CSSProperties | undefined => {
    if (typeof window === "undefined") return undefined
    const h = window.innerHeight
    // Phones: full width, sitting just above the bubble so it stays visible.
    if (window.innerWidth < 640) return { left: 8, right: 8, bottom: h - top + GAP, height: Math.min(PANEL_MAX_H, top - GAP - TOP_RESERVE + 16) }
    // Beside the bubble, never over it: level with its bottom edge, or opening downwards when the bubble sits high.
    const across = side === "right" ? { right: EDGE + SIZE + GAP } : { left: contentLeft() + EDGE + SIZE + GAP }
    const anchor = top + SIZE
    return anchor >= h / 2
      ? { ...across, width: PANEL_W, bottom: h - anchor, height: Math.min(PANEL_MAX_H, anchor - EDGE) }
      : { ...across, width: PANEL_W, top, height: Math.min(PANEL_MAX_H, h - top - EDGE) }
  })()

  return (
    <>
      <div ref={viewportRef} className={VIEWPORT_CLASS} aria-hidden="true" />
      {/* framer-motion owns the drag and the settle; the bubble itself is Grammar's floating accent action (0.9.3). */}
      <motion.div
        className={BUBBLE_CLASS}
        style={{ x, y, visibility: ready ? "visible" : "hidden" }}
        drag
        dragMomentum={false}
        dragElastic={0.08}
        dragConstraints={viewportRef}
        whileTap={reduce ? undefined : { scale: 0.94 }}
        onDragStart={() => { dragged.current = true }}
        // framer starts its own release animation right after onDragEnd; settle on the next frame so ours is not cancelled.
        onDragEnd={() => requestAnimationFrame(() => settle(x.get() + SIZE / 2 < window.innerWidth / 2 ? "left" : "right", y.get()))}
      >
        <IconButton
          source={nivoIconSource(open ? "close" : "support", "leading")}
          label={open ? t("close") : t("open")}
          variant="primary"
          size="lg"
          isFloating
          aria-expanded={open}
          aria-controls={panelId}
          onPress={() => {
            // A press that ends a drag is not a click.
            if (dragged.current) {
              dragged.current = false
              return
            }
            setOpen((o) => !o)
          }}
        />
      </motion.div>

      <AnimatePresence>
        {open ? (
          <motion.section
            key="guide-panel"
            id={panelId}
            role="dialog"
            aria-label={t("title")}
            className={PANEL_CLASS}
            style={panelStyle}
            initial={reduce ? false : { opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: reduce ? 0 : 0.18, ease: [0.4, 0, 0.2, 1] }}
          >
            {/* SURFACE-2 / BOUNDARY-6: the panel is one top-level card (theme shadow, no border); its bands are joined inside it. */}
            <SurfaceCard ariaLabel={t("title")} composition="joined" height="fill">
              <div className={PANEL_BODY_CLASS}>
                <header className={PANEL_HEAD_CLASS}>
                  <div className={PANEL_HEAD_TEXT_CLASS}>
                    <Text weight="semibold">{t("title")}</Text>
                    <Text size="xs" tone="muted">{here ? t("here", { page: here.title[locale] }) : t("subtitle")}</Text>
                  </div>
                  <CloseButton label={t("close")} size="sm" onPress={() => setOpen(false)} />
                </header>

                <div ref={listRef} className={MESSAGES_CLASS} aria-live="polite">
                  <ChatBubble side="incoming"><Text as="p" size="sm">{t("greeting")}</Text></ChatBubble>
                  {messages.map((m) => m.role === "user" ? (
                    <ChatBubble key={m.id} side="outgoing"><Text as="p" size="sm">{m.text}</Text></ChatBubble>
                  ) : (
                    <ChatBubble
                      key={m.id}
                      side="incoming"
                      {...(m.reply.source === "ai" ? { footer: <Text size="xs" tone="muted">{t("aiNote")}</Text> } : {})}
                    >
                      <div className={REPLY_CLASS}>
                        <Text as="p" size="sm">{m.reply.answer}</Text>
                        {m.reply.steps.length ? (
                          <>
                            <Text size="xs" tone="muted">{t("steps")}</Text>
                            <List as="ol" className={STEPS_CLASS} label={t("steps")}>
                              {m.reply.steps.map((step, i) => <ListItem key={step}><Text size="sm">{`${i + 1}. ${step}`}</Text></ListItem>)}
                            </List>
                          </>
                        ) : null}
                        {m.reply.links.length ? (
                          <div className={LINKS_CLASS}>
                            {m.reply.links.map((l) => <Button key={l.pageId} variant="outline" size="sm" onPress={() => go(l)}>{l.label}</Button>)}
                          </div>
                        ) : null}
                      </div>
                    </ChatBubble>
                  ))}
                  {isPending ? <ChatBubble side="incoming"><Text as="p" size="sm" tone="muted">{t("thinking")}</Text></ChatBubble> : null}
                </div>

                {messages.length === 0 ? (
                  <div className={SUGGEST_CLASS}>
                    {suggestions.map((s) => <Button key={s} variant="secondary" size="sm" isDisabled={isPending} onPress={() => send(s)}>{s}</Button>)}
                  </div>
                ) : null}

                <div className={FOOT_CLASS}>
                  <Form label={t("title")} onSubmit={onSubmit} isPending={isPending}>
                    <div className={ASK_ROW_CLASS}>
                      <div className={ASK_INPUT_CLASS}>
                        <Input id={`${panelId}-q`} name="question" label={t("questionLabel")} placeholder={t("placeholder")} variant="secondary" value={question} onValueChange={setQuestion} />
                      </div>
                      <Button type="submit" variant="primary" isPending={isPending} isDisabled={!question.trim()}>{t("send")}</Button>
                    </div>
                  </Form>
                  {messages.length ? <div><Button variant="ghost" size="sm" isDisabled={isPending} onPress={() => setMessages([])}>{t("restart")}</Button></div> : null}
                </div>
              </div>
            </SurfaceCard>
          </motion.section>
        ) : null}
      </AnimatePresence>
    </>
  )
}
