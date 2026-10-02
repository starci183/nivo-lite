"use client"

import { useId, useState, useTransition } from "react"
import { Alert, Button, Input, SurfaceCard, Text } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { knowledge } from "@/i18n/dict/knowledge"
import { addKnowledge } from "@/lib/knowledge/actions"
import { faqToText } from "@/lib/knowledge/chunk"
import { MAX_SOURCE_CHARS, type SourceKind, type Visibility } from "@/lib/knowledge/shared"
import { MODULE_KEYS, type ModuleKey } from "@/lib/modules-shared"
import { FAQ_ROW_CLASS, FIELD_CLASS, FORM_GRID_CLASS, LABEL_CLASS, ROW_WRAP_CLASS, STACK_CLASS, TAB_ROW_CLASS, TEXTAREA_CLASS } from "./classNames"

type Tab = "text" | "faq" | "file" | "url"
export type AddPreset = { readonly topic: string; readonly visibility?: Visibility; readonly nonce: number }

type AddSourceProps = {
  readonly topics: ReadonlyArray<string>
  readonly preset: AddPreset | null
  readonly onDone: () => void
  readonly onCancel: () => void
}

const TABS: ReadonlyArray<Tab> = ["text", "faq", "file", "url"]

/** "Thêm tri thức": text, Q&A pairs, a .txt/.md file or a link. Only a name and some content are required. */
export const AddSource = ({ topics, preset, onDone, onCancel }: AddSourceProps) => {
  const t = useT(knowledge)
  const listId = useId()
  const [tab, setTab] = useState<Tab>("text")
  const [title, setTitle] = useState("")
  const [topic, setTopic] = useState(preset?.topic ?? "")
  const [tags, setTags] = useState("")
  const [content, setContent] = useState("")
  const [pairs, setPairs] = useState([{ q: "", a: "" }])
  const [url, setUrl] = useState("")
  const [fileName, setFileName] = useState("")
  const [visibility, setVisibility] = useState<Visibility>(preset?.visibility ?? "internal")
  const [module, setModule] = useState<"all" | ModuleKey>("all")
  const [error, setError] = useState<string | null>(null)
  const [isPending, start] = useTransition()

  const onFile = async (file: File | undefined) => {
    setError(null)
    if (!file) return
    if (!/\.(txt|md|markdown)$/i.test(file.name)) { setError(t("fileBadType")); return }
    const text = await file.text()
    if (text.length > MAX_SOURCE_CHARS) { setError(t("saveFailed")); return }
    setContent(text)
    setFileName(file.name)
    setTitle((cur) => cur || file.name.replace(/\.[^.]+$/, ""))
  }

  const body = tab === "faq" ? faqToText(pairs) : tab === "url" ? url : content
  const canSave = title.trim().length > 0 && body.trim().length > 0

  const save = () => {
    setError(null)
    start(async () => {
      const result = await addKnowledge({
        kind: tab, title, content: body, topic: topic.trim() || null, visibility, module: module === "all" ? null : module,
        tags: tags.split(",").map((x) => x.trim()).filter(Boolean),
      })
      if (!result.ok) { setError(result.error); return }
      if (result.data.status === "failed") { setError(result.data.error ?? t("saveFailed")); }
      onDone()
    })
  }

  return (
    <SurfaceCard label={t("addTitle")} headingLevel={2}>
      <form className={STACK_CLASS} onSubmit={(e) => { e.preventDefault(); if (canSave) save() }}>
        <div className={TAB_ROW_CLASS} role="tablist">
          {TABS.map((k) => (
            <Button key={k} variant={tab === k ? "primary" : "secondary"} size="sm" onPress={() => setTab(k)}>
              {t(`tab${k === "text" ? "Text" : k === "faq" ? "Faq" : k === "file" ? "File" : "Url"}`)}
            </Button>
          ))}
        </div>

        <div className={FORM_GRID_CLASS}>
          <Input id="k-title" name="title" label={t("fieldTitle")} hint={t("fieldTitleHint")} variant="secondary" isRequired isDisabled={isPending} value={title} onValueChange={setTitle} />
          <label className={LABEL_CLASS}>
            {t("fieldTopic")}
            <input className={FIELD_CLASS} list={listId} name="topic" maxLength={80} value={topic} disabled={isPending} onChange={(e) => setTopic(e.target.value)} />
            <datalist id={listId}>{topics.map((x) => <option key={x} value={x} />)}</datalist>
            <span className="text-xs font-normal text-muted">{t("fieldTopicHint")}</span>
          </label>
        </div>

        {tab === "text" ? (
          <label className={LABEL_CLASS}>
            {t("fieldContent")}
            <textarea className={TEXTAREA_CLASS} rows={9} name="content" value={content} disabled={isPending} onChange={(e) => setContent(e.target.value)} />
            <span className="text-xs font-normal text-muted">{t("fieldContentHint")}</span>
          </label>
        ) : null}

        {tab === "faq" ? (
          <div className={STACK_CLASS}>
            {pairs.map((p, i) => (
              <div key={i} className={FAQ_ROW_CLASS}>
                <label className={LABEL_CLASS}>
                  {t("faqQuestion")}
                  <input className={FIELD_CLASS} value={p.q} disabled={isPending} onChange={(e) => setPairs((cur) => cur.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} />
                </label>
                <label className={LABEL_CLASS}>
                  {t("faqAnswer")}
                  <textarea className={TEXTAREA_CLASS} rows={3} value={p.a} disabled={isPending} onChange={(e) => setPairs((cur) => cur.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} />
                </label>
                {pairs.length > 1 ? <div><Button variant="ghost" size="sm" onPress={() => setPairs((cur) => cur.filter((_, j) => j !== i))}>{t("faqRemoveRow")}</Button></div> : null}
              </div>
            ))}
            <div><Button variant="secondary" size="sm" onPress={() => setPairs((cur) => [...cur, { q: "", a: "" }])}>{t("faqAddRow")}</Button></div>
          </div>
        ) : null}

        {tab === "file" ? (
          <div className={STACK_CLASS}>
            <label className={LABEL_CLASS}>
              {t("fileChoose")}
              <input className={FIELD_CLASS} type="file" accept=".txt,.md,.markdown,text/plain,text/markdown" disabled={isPending} onChange={(e) => { void onFile(e.target.files?.[0]) }} />
            </label>
            <Text size="xs" tone="muted">{fileName ? t("fileLoaded", { name: fileName, chars: content.length.toLocaleString("vi-VN") }) : t("fileHint")}</Text>
          </div>
        ) : null}

        {tab === "url" ? (
          <Input id="k-url" name="url" label={t("urlField")} hint={t("urlHint")} variant="secondary" isDisabled={isPending} value={url} onValueChange={setUrl} />
        ) : null}

        <div className={FORM_GRID_CLASS}>
          <label className={LABEL_CLASS}>
            {t("fieldVisibility")}
            <select className={FIELD_CLASS} value={visibility} disabled={isPending} onChange={(e) => setVisibility(e.target.value === "public" ? "public" : "internal")}>
              <option value="internal">{t("visInternal")}</option>
              <option value="public">{t("visPublic")}</option>
            </select>
          </label>
          <label className={LABEL_CLASS}>
            {t("fieldModule")}
            <select className={FIELD_CLASS} value={module} disabled={isPending} onChange={(e) => setModule(e.target.value as "all" | ModuleKey)}>
              <option value="all">{t("moduleAll")}</option>
              {MODULE_KEYS.map((k) => <option key={k} value={k}>{t(`module_${k}`)}</option>)}
            </select>
          </label>
          <Input id="k-tags" name="tags" label={t("fieldTags")} variant="secondary" isDisabled={isPending} value={tags} onValueChange={setTags} />
        </div>

        {error !== null ? <Alert title={t("saveFailed")} description={error} tone="negative" /> : null}
        <div className={ROW_WRAP_CLASS}>
          <Button variant="primary" isPending={isPending} isDisabled={!canSave} onPress={save}>{isPending ? t("saving") : t("save")}</Button>
          <Button variant="ghost" isDisabled={isPending} onPress={onCancel}>{t("addCancel")}</Button>
        </div>
      </form>
    </SurfaceCard>
  )
}
