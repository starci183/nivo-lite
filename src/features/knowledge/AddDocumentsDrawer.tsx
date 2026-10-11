"use client"

import { useEffect, useRef, useState } from "react"
import { Alert, Badge, Button, ComboBox, Drawer, FileDropzone, Input, List, ListItem, ListRow, SegmentedControl, Select, SurfaceListCard, Text, Textarea } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { knowledge } from "@/i18n/dict/knowledge"
import { CreditsAlert } from "@/features/brain/CreditsAlert"
import { extractionSettled, type ExtractionInfo } from "@/lib/brain/shared"
import { addKnowledge, addKnowledgeDriveFile, addKnowledgeFile, addKnowledgeLink, addKnowledgePickedFile, disconnectDriveGrant, driveGrantStatus, listDriveFolder, listPickedFolder, pollExtractions, startDriveGrant } from "@/lib/knowledge/actions"
import { faqToText } from "@/lib/knowledge/chunk"
import { driveReadMode, isGoogleDriveLink, LINK_ERROR, linkErrorCode, MAX_FOLDER_FILES, parseLinks, resolveLink } from "@/lib/knowledge/drive"
import type { DriveGrant } from "@/lib/knowledge/drive-grant"
import type { Visibility } from "@/lib/knowledge/shared"
import { MODULE_KEYS, type ModuleKey } from "@/lib/modules-shared"
import { driveReturn, savePending, takePending } from "./driveReturn"
import { pickerConfigured, pickFromDrive, type PickedDoc } from "./picker"
import { FAQ_ROW_CLASS, FORM_GRID_CLASS, LIST_CLASS, ROW_WRAP_CLASS, STACK_CLASS } from "./classNames"

type Mode = "files" | "write" | "faq"
type ItemStatus = "waiting" | "indexing" | "ready" | "failed"
type Item = {
  readonly id: string
  readonly kind: "file" | "link" | "drive"
  /** A file found inside a pasted Drive folder: read with the Drive grant by id. */
  readonly driveId?: string
  /** Picked in the Google Picker: read with the short-lived Picker token held in this drawer (never stored). */
  readonly viaPicker?: boolean
  /** Topic used when the topic field is empty (the folder's name). */
  readonly topic?: string
  /** The folder it came from. */
  readonly origin?: string
  readonly name: string
  readonly size?: number
  readonly file?: File
  readonly status: ItemStatus
  /** The source created for it once indexed: its facts are read afterwards (brain_extractions). */
  readonly sourceId?: string
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

const NEED_GRANT = `${LINK_ERROR.needGrant}: `
const GRANT_LOST = `${LINK_ERROR.grantLost}: `
type Grant = DriveGrant & { readonly configured: boolean }
const isFolderLink = (url: string): boolean => resolveLink(url).kind === "drive-folder"
const NO_RETRY = new Set(["errBadType", "errTooBig", "errBadLink", "errEmptyFolder", "errDriveType", "errPickerFolder"])
const canRetry = (x: { readonly status: ItemStatus; readonly error?: string }): boolean =>
  x.status === "waiting" || (x.status === "failed" && !NO_RETRY.has(x.error ?? "") && linkErrorCode(x.error ?? "") !== LINK_ERROR.tokenExpired)

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
  const [grant, setGrant] = useState<Grant | null>(null)
  const [reading, setReading] = useState(false)
  const [truncated, setTruncated] = useState(false)
  const [driveAnswer, setDriveAnswer] = useState<{ readonly ok: boolean; readonly reason: string | null } | null>(null)
  const grantRef = useRef<Grant | null>(null)
  const pickerToken = useRef<string | null>(null)
  const [picking, setPicking] = useState(false)
  const showPicker = pickerConfigured()
  grantRef.current = grant

  const loadGrant = async (): Promise<Grant | null> => {
    const r = await driveGrantStatus()
    const next = r.ok ? r.data : null
    grantRef.current = next
    setGrant(next)
    return next
  }
  // The workspace's Drive access, and what to restore when Google sent the browser back here (answer + the links that were pasted).
  useEffect(() => {
    void loadGrant()
    const back = driveReturn()
    const pending = takePending()
    if (back) setDriveAnswer({ ok: back.result === "ok", reason: back.reason })
    if (pending) {
      setLinks(pending.links); setTopic((cur) => cur || pending.topic); setTags(pending.tags)
      setVisibility(pending.visibility); setModule(MODULE_KEYS.find((k) => k === pending.module) ?? "all")
    }
  }, [])

  // A new suggestion preset reopens on "Write" with its topic filled in.
  useEffect(() => {
    if (preset && preset.nonce !== seenPreset.current) {
      seenPreset.current = preset.nonce
      setMode("write")
      setTopic(preset.topic)
      setVisibility(preset.visibility ?? "internal")
    }
  }, [preset])

  // Progress of reading facts out of the documents added in this run: polled while any is still being read (the poll also nudges waiting work).
  const [extractions, setExtractions] = useState<Record<string, ExtractionInfo>>({})
  const watched = items.filter((x) => x.status === "ready" && x.sourceId).map((x) => x.sourceId as string)
  const watchedKey = watched.join(",")
  const unsettled = watched.some((id) => { const e = extractions[id]; return !e || !extractionSettled(e.status) })
  useEffect(() => {
    if (!isOpen || !unsettled) return
    let cancelled = false
    const ids = watchedKey.split(",").filter(Boolean)
    const tick = async () => {
      const r = await pollExtractions(ids)
      if (!cancelled && r.ok) setExtractions((cur) => ({ ...cur, ...Object.fromEntries(r.data.map((x) => [x.sourceId, x])) }))
    }
    void tick()
    const handle = setInterval(() => { void tick() }, 5000)
    return () => { cancelled = true; clearInterval(handle) }
  }, [isOpen, unsettled, watchedKey])
  const outOfCredits = watched.some((id) => extractions[id]?.status === "blocked_credits")
  const factsNote = (id: string | undefined): string | null => {
    if (!id) return null
    const e = extractions[id]
    if (!e || e.status === "queued" || e.status === "running") return t("extReading")
    if (e.status === "done") return e.factsProposed > 0 ? t("extDone", { n: e.factsProposed }) : t("extNone")
    return e.status === "blocked_credits" ? t("extBlocked") : t("extFailed")
  }

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

  /** Pasted links -> queue rows. A Drive folder becomes one row per file (recursive, see drive-api.ts); without the grant its row fails with "Cần cấp quyền Google Drive". */
  const expand = async (urls: ReadonlyArray<string>): Promise<Array<Item>> => {
    const out: Array<Item> = []
    for (const u of urls) {
      const target = resolveLink(u)
      if (target.kind === "invalid") { out.push({ id: nextId(), kind: "link", name: u, status: "failed", error: "errBadLink" }); continue }
      if (target.kind !== "drive-folder") { out.push({ id: nextId(), kind: "link", name: u, status: "waiting" }); continue }
      const g = grantRef.current ?? (await loadGrant())
      if (!g || g.state !== "connected") { out.push({ id: nextId(), kind: "link", name: u, status: "failed", error: g?.state === "lost" ? GRANT_LOST : NEED_GRANT }); continue }
      const r = await listDriveFolder(u)
      if (!r.ok) { out.push({ id: nextId(), kind: "link", name: u, status: "failed", error: r.error }); continue }
      if (r.data.truncated) setTruncated(true)
      if (r.data.files.length === 0) { out.push({ id: nextId(), kind: "link", name: u, status: "failed", error: "errEmptyFolder" }); continue }
      setTopic((cur) => cur || r.data.name.slice(0, 80))
      for (const f of r.data.files) {
        const label = f.path ? `${f.path}/${f.name}` : f.name
        const bad = driveReadMode(f.mimeType, f.name) === null ? "errDriveType" : f.size !== null && f.size > MAX_FILE_BYTES ? "errTooBig" : null
        out.push({ id: nextId(), kind: "drive", name: label, driveId: f.id, topic: r.data.name.slice(0, 80), origin: r.data.name, ...(f.size !== null ? { size: f.size } : {}), status: bad ? "failed" : "waiting", ...(bad ? { error: bad } : {}) })
      }
    }
    return out
  }

  const queueLinks = async (): Promise<void> => {
    const urls = parseLinks(links)
    if (urls.length === 0) return
    setLinks("")
    setReading(true)
    const known = new Set(items.filter((x) => x.kind === "link").map((x) => x.name))
    const fresh = await expand(urls.filter((u) => !known.has(u)))
    setReading(false)
    setItems((cur) => {
      const have = new Set(cur.filter((x) => x.driveId).map((x) => x.driveId))
      return [...cur, ...fresh.filter((x) => !x.driveId || !have.has(x.driveId))]
    })
  }

  /** Google Picker (drive.file): the picked files become rows; a picked folder is listed with the Picker token, and when Google returns nothing or refuses (403/404) its row says to pick the files inside. */
  const pickDrive = async (): Promise<void> => {
    setError(null)
    setPicking(true)
    try {
      const picked = await pickFromDrive()
      if (!picked || picked.docs.length === 0) return
      pickerToken.current = picked.token
      const rows: Array<Item> = []
      for (const d of picked.docs) {
        if (d.mimeType === "application/vnd.google-apps.folder") rows.push(...(await pickedFolderRows(d, picked.token)))
        else rows.push(pickedFileRow(d))
      }
      setItems((cur) => {
        const have = new Set(cur.filter((x) => x.driveId).map((x) => x.driveId))
        return [...cur, ...rows.filter((x) => !x.driveId || !have.has(x.driveId))]
      })
    } catch {
      setError(t("pickerFailed"))
    } finally {
      setPicking(false)
    }
  }

  const pickedFileRow = (d: PickedDoc, origin?: string, topicName?: string): Item => {
    const bad = driveReadMode(d.mimeType, d.name) === null ? "errDriveType" : null
    return { id: nextId(), kind: "drive", viaPicker: true, name: d.name, driveId: d.id, status: bad ? "failed" : "waiting", ...(origin ? { origin } : {}), ...(topicName ? { topic: topicName } : {}), ...(bad ? { error: bad } : {}) }
  }

  const pickedFolderRows = async (d: PickedDoc, token: string): Promise<Array<Item>> => {
    const r = await listPickedFolder(d.id, token)
    if (!r.ok) return [{ id: nextId(), kind: "drive", viaPicker: true, name: d.name, driveId: d.id, status: "failed", error: r.error }]
    if (r.data.empty) return [{ id: nextId(), kind: "drive", viaPicker: true, name: d.name, driveId: d.id, status: "failed", error: "errPickerFolder" }]
    if (r.data.truncated) setTruncated(true)
    setTopic((cur) => cur || d.name.slice(0, 80))
    return r.data.files.map((f) => ({ ...pickedFileRow({ id: f.id, name: f.path ? `${f.path}/${f.name}` : f.name, mimeType: f.mimeType }, d.name, d.name.slice(0, 80)), ...(f.size !== null ? { size: f.size } : {}) }))
  }

  /** Keep the pasted links and settings, then go to Google for the Drive consent; the callback brings the browser back to this page. */
  const connectDrive = async (): Promise<void> => {
    setError(null); setDriveAnswer(null)
    const kept = [links, ...items.filter((x) => x.kind === "link" && x.status !== "ready").map((x) => x.name)].filter(Boolean).join("\n")
    savePending({ links: kept, topic, tags, visibility, module })
    const r = await startDriveGrant(`${window.location.pathname}${window.location.search}`)
    if (r.ok) window.location.assign(r.data.url)
    else setError(r.error)
  }

  const disconnectDrive = async (): Promise<void> => {
    const r = await disconnectDriveGrant()
    if (!r.ok) { setError(r.error); return }
    await loadGrant()
  }

  const message = (raw: string): string => {
    switch (raw) {
      case "errBadType": case "errTooBig": case "errBadLink": case "errEmptyFolder": case "errDriveType": case "errPickerFolder": return t(raw)
      default: {
        const code = linkErrorCode(raw)
        return code === LINK_ERROR.notPublic ? t("errNotPublic") : code === LINK_ERROR.folder ? t("errFolder") : code === LINK_ERROR.unsupported ? t("errUnsupported")
          : code === LINK_ERROR.needGrant ? t("errNeedGrant") : code === LINK_ERROR.grantLost ? t("errGrantLost") : code === LINK_ERROR.noAccess ? t("errNoAccess") : code === LINK_ERROR.tokenExpired ? t("errPickerExpired") : raw
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
      } else if (item.kind === "drive" && item.driveId && item.viaPicker) {
        if (!pickerToken.current) { patch(item.id, { status: "failed", error: `${LINK_ERROR.tokenExpired}: ` }); return false }
        result = await addKnowledgePickedFile(item.driveId, pickerToken.current, { ...m, topic: m.topic ?? item.topic ?? null })
      } else if (item.kind === "drive" && item.driveId) {
        result = await addKnowledgeDriveFile(item.driveId, { ...m, topic: m.topic ?? item.topic ?? null })
      } else {
        result = await addKnowledgeLink(item.name, m)
      }
      if (!result.ok) { patch(item.id, { status: "failed", error: result.error }); return false }
      if (result.data.status === "failed") { patch(item.id, { status: "failed", error: result.data.error ?? t("saveFailed") }); return false }
      patch(item.id, { status: "ready", sourceId: result.data.id })
      return true
    } catch (e) {
      patch(item.id, { status: "failed", error: e instanceof Error ? e.message : String(e) })
      return false
    }
  }

  const runBatch = async () => {
    setBusy(true)
    setError(null)
    // Links still sitting in the textarea join the queue first (a Drive folder expands into its files).
    const typed = parseLinks(links).filter((u) => !items.some((x) => x.kind === "link" && x.name === u))
    const typedItems = typed.length > 0 ? await expand(typed) : []
    if (typedItems.length > 0) { setItems((cur) => [...cur, ...typedItems]); setLinks("") }
    // A folder row that failed earlier (no grant yet, ...) is expanded again now.
    const queue: Array<Item> = []
    for (const x of items.filter(canRetry)) {
      if (x.kind === "link" && isFolderLink(x.name)) {
        const rows = await expand([x.name])
        setItems((cur) => cur.flatMap((y) => (y.id === x.id ? rows : [y])))
        queue.push(...rows.filter((y) => y.status === "waiting"))
      } else queue.push(x)
    }
    queue.push(...typedItems.filter((x) => x.status === "waiting"))
    if (queue.length === 0) { setBusy(false); return }
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

  const retryable = items.filter(canRetry)
  const pendingCount = retryable.length + parseLinks(links).filter((u) => !items.some((x) => x.kind === "link" && x.name === u)).length
  const hasFailed = items.some((x) => x.status === "failed")
  const wantsDrive = parseLinks(links).some(isGoogleDriveLink) || items.some((x) => x.kind === "link" && (isGoogleDriveLink(x.name) || x.error?.startsWith(LINK_ERROR.needGrant)))
  const driveReason = driveAnswer && !driveAnswer.ok
    ? t(driveAnswer.reason === "denied" ? "driveErrDenied" : driveAnswer.reason === "scope" ? "driveErrScope" : driveAnswer.reason === "unavailable" ? "driveErrUnavailable" : "driveErrGeneric")
    : null
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
      isDismissable={!busy && !picking}
      isKeyboardDismissDisabled={busy || picking}
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
              <Button variant="secondary" size="sm" isDisabled={busy || reading || parseLinks(links).length === 0} onPress={() => { void queueLinks() }}>{t("linksQueue")}</Button>
              {showPicker ? <Button variant="secondary" size="sm" isPending={picking} isDisabled={busy || reading} onPress={() => { void pickDrive() }}>{t("pickerButton")}</Button> : null}
              {reading ? <Text size="sm" tone="muted">{t("folderReading")}</Text> : null}
            </div>
            {showPicker ? <Text size="sm" tone="muted">{t("pickerHint")}</Text> : null}
            {grant?.state === "connected" ? (
              <div className={ROW_WRAP_CLASS}>
                <Text size="sm" tone="muted">{t("driveConnected", { email: grant.email || "Google" })}</Text>
                <Button variant="ghost" size="sm" isDisabled={busy} onPress={() => { void disconnectDrive() }}>{t("driveDisconnect")}</Button>
              </div>
            ) : grant?.configured && (wantsDrive || grant.state === "lost" || driveReason) ? (
              <div className={STACK_CLASS}>
                <Alert tone="informative" appearance="soft" title={t("driveAlertTitle")} description={grant.state === "lost" ? t("driveLostBody") : t("driveAlertBody")} />
                <div className={ROW_WRAP_CLASS}>
                  <Button variant="secondary" size="sm" isDisabled={busy} onPress={() => { void connectDrive() }}>{t(grant.state === "lost" ? "driveRegrant" : "driveGrant")}</Button>
                </div>
              </div>
            ) : null}
            {driveReason ? <Alert tone="negative" title={driveReason} /> : null}
            {truncated ? <Alert tone="cautionary" appearance="soft" title={t("folderTruncated", { count: MAX_FOLDER_FILES })} /> : null}
            {items.length > 0 ? (
              <SurfaceListCard label={t("queueTitle")} headingLevel={3} fact={t("queueCount", { count: items.length })}>
                {items.map((x) => (
                  <ListRow
                    key={x.id}
                    title={x.name}
                    description={x.status === "failed" && x.error ? message(x.error) : [t(x.kind === "file" ? "itemFile" : x.kind === "drive" ? "itemDrive" : isFolderLink(x.name) ? "itemFolder" : "itemLink"), x.origin ? t("folderFrom", { name: x.origin }) : null, x.size ? sizeLabel(x.size) : null, x.status === "ready" ? factsNote(x.sourceId) : null].filter(Boolean).join(" · ")}
                    badges={<Badge isDot tone={STATUS_TONE[x.status]}>{t(`item${x.status[0]?.toUpperCase()}${x.status.slice(1)}` as "itemWaiting")}</Badge>}
                    actions={x.status === "waiting" || x.status === "failed" ? <Button variant="ghost" size="sm" isDisabled={busy} onPress={() => setItems((cur) => cur.filter((y) => y.id !== x.id))}>{t("itemRemove")}</Button> : undefined}
                  />
                ))}
              </SurfaceListCard>
            ) : null}
            {doneCount > 0 && !busy ? <Alert title={t("batchDone", { count: doneCount })} tone="affirmative" /> : null}
            {outOfCredits ? <CreditsAlert /> : null}
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
