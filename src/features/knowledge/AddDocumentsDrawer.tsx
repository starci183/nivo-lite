"use client"

import { useEffect, useRef, useState } from "react"
import { Alert, Badge, Button, ComboBox, Drawer, FileDropzone, Input, List, ListItem, ListRow, SegmentedControl, Select, SurfaceListCard, Textarea } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { knowledge } from "@/i18n/dict/knowledge"
import { addKnowledge, addKnowledgeFile, addKnowledgeLink } from "@/lib/knowledge/actions"
import { faqToText } from "@/lib/knowledge/chunk"
import { LINK_ERROR, linkErrorCode, parseLinks, resolveLink } from "@/lib/knowledge/drive"
import type { Visibility } from "@/lib/knowledge/shared"
import { MODULE_KEYS, type ModuleKey } from "@/lib/modules-shared"
import { FAQ_ROW_CLASS, FORM_GRID_CLASS, LIST_CLASS, ROW_WRAP_CLASS, STACK_CLASS } from "./classNames"

type Mode = "files" | "write" | "faq"
type ItemStatus = "waiting" | "indexing" | "ready" | "failed"
type Item = {
  readonly id: string
  readonly kind: "file" | "link"
  readonly name: string
  readonly size?: number
  readonly file?: File
  readonly status: ItemStatus
  /** Raw server message, or a ready-made key for a client-side failure. */
  readonly error?: string
}

/** Opens the drawer on "Write" with a topic (and visibility) already chosen, e.g. from a "Worth adding" suggestion. */
export type AddPreset = { readonly topic: string; readonly visibility?: Visibility; readonly nonce: number }

export type AddDocumentsDrawerProps = {
  readonly isOpen: boolean
  readonly onClose: () => void
  /** Called once a run has added at least one document (refresh the page behind). */
  readonly onAdded?: () => void
  /** Topics already used, offered in the topic field. */
  readonly topics?: ReadonlyArray<string>
  readonly preset?: AddPreset | null
}

const FILE_TYPES = /\.(txt|md|markdown|csv|pdf|docx)$/i
const MAX_FILE_BYTES = 10_000_000
const CONCURRENCY = 2
const ACCEPT = ".txt,.md,.markdown,.csv,.pdf,.docx,text/plain,text/markdown,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
const STATUS_TONE: Record<ItemStatus, "neutral" | "warning" | "success" | "danger"> = { waiting: "neutral", indexing: "warning", ready: "success", failed: "danger" }

const sizeLabel = (bytes: number): string => (bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`)
let counter = 0
const nextId = (): string => `item-${Date.now()}-${counter++}`

/**
 * "Thêm tài liệu": add many files and links in one go (default tab), or write a note / Q&A pair.
 * Visibility, module, topic and tags are chosen once for the whole batch. Items are processed two at a time.
 */
export const AddDocumentsDrawer = ({ isOpen, onClose, onAdded, topics = [], preset = null }: AddDocumentsDrawerProps) => {
  const t = useT(knowledge)
  const [mode, setMode] = useState<Mode>(preset ? "write" : "files")
  const [items, setItems] = useState<ReadonlyArray<Item>>([])
  const [links, setLinks] = useState("")
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [pairs, setPairs] = useState([{ q: "", a: "" }])
  const [topic, setTopic] = useState(preset?.topic ?? "")
  const [tags, setTags] = useState("")
  const [visibility, setVisibility] = useState<Visibility>(preset?.visibility ?? "internal")
  const [module, setModule] = useState<"all" | ModuleKey>("all")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [doneCount, setDoneCount] = useState(0)
  const seenPreset = useRef<number | null>(preset?.nonce ?? null)

  // A new suggestion preset reopens on "Write" with its topic filled in.
  useEffect(() => {
    if (preset && preset.nonce !== seenPreset.current) {
      seenPreset.current = preset.nonce
      setMode("write")
      setTopic(preset.topic)
      setVisibility(preset.visibility ?? "internal")
    }
  }, [preset])

  const patch = (id: string, change: Partial<Item>) => setItems((cur) => cur.map((x) => (x.id === id ? { ...x, ...change } : x)))

  const addFiles = (files: Array<File>) => {
    setItems((cur) => {
      const fresh: Array<Item> = []
      for (const f of files) {
        if (cur.some((x) => x.kind === "file" && x.name === f.name && x.size === f.size) || fresh.some((x) => x.name === f.name && x.size === f.size)) continue
        const bad = !FILE_TYPES.test(f.name) ? "errBadType" : f.size > MAX_FILE_BYTES ? "errTooBig" : null
        fresh.push({ id: nextId(), kind: "file", name: f.name, size: f.size, file: f, status: bad ? "failed" : "waiting", ...(bad ? { error: bad } : {}) })
      }
      return [...cur, ...fresh]
    })
  }

  const queueLinks = (): void => {
    const urls = parseLinks(links)
    if (urls.length === 0) return
    setItems((cur) => {
      const known = new Set(cur.filter((x) => x.kind === "link").map((x) => x.name))
      const fresh: Array<Item> = urls.filter((u) => !known.has(u)).map((u) => {
        const invalid = resolveLink(u).kind === "invalid"
        return { id: nextId(), kind: "link", name: u, status: invalid ? "failed" : "waiting", ...(invalid ? { error: "errBadLink" } : {}) } as Item
      })
      return [...cur, ...fresh]
    })
    setLinks("")
  }

  const message = (raw: string): string => {
    switch (raw) {
      case "errBadType": case "errTooBig": case "errBadLink": return t(raw)
      default: {
        const code = linkErrorCode(raw)
        return code === LINK_ERROR.notPublic ? t("errNotPublic") : code === LINK_ERROR.folder ? t("errFolder") : code === LINK_ERROR.unsupported ? t("errUnsupported") : raw
      }
    }
  }

  const meta = () => ({ topic: topic.trim() || null, visibility, module: module === "all" ? null : module, tags: tags.split(",").map((x) => x.trim()).filter(Boolean) })

  const runOne = async (item: Item): Promise<boolean> => {
    patch(item.id, { status: "indexing", error: undefined })
    try {
      const m = meta()
      let result
      if (item.kind === "file" && item.file) {
        const form = new FormData()
        form.set("file", item.file)
        form.set("visibility", m.visibility)
        form.set("module", m.module ?? "")
        form.set("topic", m.topic ?? "")
        form.set("tags", m.tags.join(","))
        result = await addKnowledgeFile(form)
      } else {
        result = await addKnowledgeLink(item.name, m)
      }
      if (!result.ok) { patch(item.id, { status: "failed", error: result.error }); return false }
      if (result.data.status === "failed") { patch(item.id, { status: "failed", error: result.data.error ?? t("saveFailed") }); return false }
      patch(item.id, { status: "ready" })
      return true
    } catch (e) {
      patch(item.id, { status: "failed", error: e instanceof Error ? e.message : String(e) })
      return false
    }
  }

  const runBatch = async () => {
    // Links still sitting in the textarea join the queue first.
    const typed = parseLinks(links).filter((u) => !items.some((x) => x.kind === "link" && x.name === u))
    const typedItems: Array<Item> = typed.map((u) => ({ id: nextId(), kind: "link", name: u, status: "waiting" }))
    if (typedItems.length > 0) { setItems((cur) => [...cur, ...typedItems]); setLinks("") }
    const queue = [...items, ...typedItems].filter((x) => x.status === "waiting" || (x.status === "failed" && x.error !== "errBadType" && x.error !== "errTooBig" && x.error !== "errBadLink"))
    if (queue.length === 0) return
    setBusy(true)
    setError(null)
    let ok = 0
    let next = 0
    const worker = async () => {
      while (next < queue.length) {
        const item = queue[next++] as Item
        if (await runOne(item)) ok++
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker))
    setBusy(false)
    setDoneCount((n) => n + ok)
    if (ok > 0) onAdded?.()
  }

  const runNote = async () => {
    setBusy(true)
    setError(null)
    const body = mode === "faq" ? faqToText(pairs) : content
    const result = await addKnowledge({ kind: mode === "faq" ? "faq" : "text", title, content: body, ...meta() })
    setBusy(false)
    if (!result.ok) { setError(result.error); return }
    if (result.data.status === "failed") { setError(result.data.error ?? t("saveFailed")); return }
    onAdded?.()
    reset()
    onClose()
  }

  const reset = () => {
    setItems([]); setLinks(""); setTitle(""); setContent(""); setPairs([{ q: "", a: "" }]); setError(null); setDoneCount(0)
  }

  const close = () => {
    if (busy) return
    reset()
    onClose()
  }

  const retryable = items.filter((x) => x.status === "waiting" || (x.status === "failed" && x.error !== "errBadType" && x.error !== "errTooBig" && x.error !== "errBadLink"))
  const pendingCount = retryable.length + parseLinks(links).filter((u) => !items.some((x) => x.kind === "link" && x.name === u)).length
  const hasFailed = items.some((x) => x.status === "failed")
  const noteBody = mode === "faq" ? faqToText(pairs) : content
  const canSubmit = mode === "files" ? pendingCount > 0 : title.trim().length > 0 && noteBody.trim().length > 0
  const submitLabel = busy ? t("saving") : mode === "files" ? t(hasFailed ? "submitRetry" : "submitFiles", { count: pendingCount }) : t("save")

  return (
    <Drawer
      isOpen={isOpen}
      onOpenChange={(o) => { if (!o) close() }}
      title={t("addTitle")}
      description={mode === "files" ? t("drawerHint") : undefined}
      closeLabel={t("addCancel")}
      placement="right"
      isDismissable={!busy}
      isKeyboardDismissDisabled={busy}
      footer={(closeDrawer) => (
        <>
          <Button variant="primary" isPending={busy} isDisabled={!canSubmit} onPress={() => { void (mode === "files" ? runBatch() : runNote()) }}>{submitLabel}</Button>
          <Button variant="ghost" isDisabled={busy} onPress={() => { closeDrawer() }}>{t("addCancel")}</Button>
        </>
      )}
    >
      <div className={STACK_CLASS}>
        <SegmentedControl
          label={t("addTitle")}
          isLabelHidden
          isDisabled={busy}
          value={mode}
          options={[{ value: "files", label: t("tabFiles") }, { value: "write", label: t("tabWrite") }, { value: "faq", label: t("tabFaq") }]}
          onValueChange={(v) => setMode(v === "write" ? "write" : v === "faq" ? "faq" : "files")}
        />

        {mode === "files" ? (
          <div className={STACK_CLASS}>
            <FileDropzone
              id="k-files" name="files" label={t("filesDrop")} isLabelHidden prompt={t("filesDrop")} description={t("filesHint")}
              multiple hideFileList accept={ACCEPT} isDisabled={busy} onFilesChange={addFiles}
            />
            <Textarea id="k-links" name="links" label={t("linksField")} description={t("linksHint")} variant="secondary" rows={4} value={links} isDisabled={busy} onValueChange={setLinks} />
            <div className={ROW_WRAP_CLASS}>
              <Button variant="secondary" size="sm" isDisabled={busy || parseLinks(links).length === 0} onPress={queueLinks}>{t("linksQueue")}</Button>
            </div>
            {items.length > 0 ? (
              <SurfaceListCard label={t("queueTitle")} headingLevel={3} fact={t("queueCount", { count: items.length })}>
                {items.map((x) => (
                  <ListRow
                    key={x.id}
                    title={x.name}
                    description={x.status === "failed" && x.error ? message(x.error) : [t(x.kind === "file" ? "itemFile" : "itemLink"), x.size ? sizeLabel(x.size) : null].filter(Boolean).join(" · ")}
                    badges={<Badge isDot tone={STATUS_TONE[x.status]}>{t(`item${x.status[0]?.toUpperCase()}${x.status.slice(1)}` as "itemWaiting")}</Badge>}
                    actions={x.status === "waiting" || x.status === "failed" ? <Button variant="ghost" size="sm" isDisabled={busy} onPress={() => setItems((cur) => cur.filter((y) => y.id !== x.id))}>{t("itemRemove")}</Button> : undefined}
                  />
                ))}
              </SurfaceListCard>
            ) : null}
            {doneCount > 0 && !busy ? <Alert title={t("batchDone", { count: doneCount })} tone="affirmative" /> : null}
          </div>
        ) : (
          <div className={STACK_CLASS}>
            <Input id="k-title" name="title" label={t("fieldTitle")} hint={t("fieldTitleHint")} variant="secondary" isRequired isDisabled={busy} value={title} onValueChange={setTitle} />
            {mode === "write" ? (
              <Textarea id="k-content" name="content" label={t("fieldContent")} description={t("fieldContentHint")} variant="secondary" rows={9} value={content} isDisabled={busy} onValueChange={setContent} />
            ) : (
              <div className={STACK_CLASS}>
                <List label={t("tabFaq")} className={LIST_CLASS}>
                  {pairs.map((p, i) => (
                    <ListItem key={i} className={FAQ_ROW_CLASS}>
                      <Input id={`k-faq-q-${i}`} name={`faq-q-${i}`} label={t("faqQuestion")} variant="secondary" value={p.q} isDisabled={busy} onValueChange={(v) => setPairs((cur) => cur.map((x, j) => (j === i ? { ...x, q: v } : x)))} />
                      <Textarea id={`k-faq-a-${i}`} name={`faq-a-${i}`} label={t("faqAnswer")} variant="secondary" rows={3} value={p.a} isDisabled={busy} onValueChange={(v) => setPairs((cur) => cur.map((x, j) => (j === i ? { ...x, a: v } : x)))} />
                      {pairs.length > 1 ? <div className={ROW_WRAP_CLASS}><Button variant="ghost" size="sm" isDisabled={busy} onPress={() => setPairs((cur) => cur.filter((_, j) => j !== i))}>{t("faqRemoveRow")}</Button></div> : null}
                    </ListItem>
                  ))}
                </List>
                <div className={ROW_WRAP_CLASS}><Button variant="secondary" size="sm" isDisabled={busy} onPress={() => setPairs((cur) => [...cur, { q: "", a: "" }])}>{t("faqAddRow")}</Button></div>
              </div>
            )}
          </div>
        )}

        <div className={FORM_GRID_CLASS}>
          <ComboBox
            id="k-topic" name="topic" label={t("fieldTopic")} description={t("fieldTopicHint")} variant="secondary" allowsCustomValue menuTrigger="focus"
            options={topics.map((x) => ({ id: x, label: x }))} inputValue={topic} isDisabled={busy}
            onInputChange={(v) => setTopic(v.slice(0, 80))} onValueChange={(v) => { if (v !== null) setTopic(v) }}
          />
          <Input id="k-tags" name="tags" label={t("fieldTags")} variant="secondary" isDisabled={busy} value={tags} onValueChange={setTags} />
          <Select
            label={t("fieldVisibility")} variant="secondary" value={visibility} isDisabled={busy}
            options={[{ id: "internal", label: t("visInternal") }, { id: "public", label: t("visPublic") }]}
            onValueChange={(v) => setVisibility(v === "public" ? "public" : "internal")}
          />
          <Select
            label={t("fieldModule")} variant="secondary" value={module} isDisabled={busy}
            options={[{ id: "all", label: t("moduleAll") }, ...MODULE_KEYS.map((k) => ({ id: k, label: t(`module_${k}`) }))]}
            onValueChange={(v) => setModule(MODULE_KEYS.find((k) => k === v) ?? "all")}
          />
        </div>

        {error !== null ? <Alert title={t("saveFailed")} description={error} tone="negative" /> : null}
      </div>
    </Drawer>
  )
}
