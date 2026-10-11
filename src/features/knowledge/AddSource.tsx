"use client"

import { useState, useTransition } from "react"
import { Alert, Button, ComboBox, FileDropzone, Form, Input, List, ListItem, SegmentedControl, Select, SurfaceCard, Text, Textarea } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { knowledge } from "@/i18n/dict/knowledge"
import { addKnowledge } from "@/lib/knowledge/actions"
import { faqToText } from "@/lib/knowledge/chunk"
import { MAX_SOURCE_CHARS, type SourceKind, type Visibility } from "@/lib/knowledge/shared"
import { MODULE_KEYS, type ModuleKey } from "@/lib/modules-shared"
import { FAQ_ROW_CLASS, FORM_GRID_CLASS, LIST_CLASS, ROW_WRAP_CLASS, STACK_CLASS } from "./classNames"

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
      <Form label={t("addTitle")} onSubmit={(_, e) => { e.preventDefault(); if (canSave) save() }}>
        <div className={STACK_CLASS}>
          <SegmentedControl
            label={t("addTitle")}
            isLabelHidden
            value={tab}
            options={TABS.map((k) => ({ value: k, label: t(`tab${k === "text" ? "Text" : k === "faq" ? "Faq" : k === "file" ? "File" : "Url"}`) }))}
            onValueChange={(v) => setTab(TABS.find((k) => k === v) ?? "text")}
          />

          <div className={FORM_GRID_CLASS}>
            <Input id="k-title" name="title" label={t("fieldTitle")} hint={t("fieldTitleHint")} variant="secondary" isRequired isDisabled={isPending} value={title} onValueChange={setTitle} />
            <ComboBox
              id="k-topic" name="topic" label={t("fieldTopic")} description={t("fieldTopicHint")} variant="secondary" allowsCustomValue menuTrigger="focus"
              options={topics.map((x) => ({ id: x, label: x }))} inputValue={topic} isDisabled={isPending}
              onInputChange={(v) => setTopic(v.slice(0, 80))} onValueChange={(v) => { if (v !== null) setTopic(v) }}
            />
          </div>

          {tab === "text" ? (
            <Textarea id="k-content" name="content" label={t("fieldContent")} description={t("fieldContentHint")} variant="secondary" rows={9} value={content} isDisabled={isPending} onValueChange={setContent} />
          ) : null}

          {tab === "faq" ? (
            <div className={STACK_CLASS}>
              <List label={t("tabFaq")} className={LIST_CLASS}>
                {pairs.map((p, i) => (
                  <ListItem key={i} className={FAQ_ROW_CLASS}>
                    <Input id={`k-faq-q-${i}`} name={`faq-q-${i}`} label={t("faqQuestion")} variant="secondary" value={p.q} isDisabled={isPending} onValueChange={(v) => setPairs((cur) => cur.map((x, j) => (j === i ? { ...x, q: v } : x)))} />
                    <Textarea id={`k-faq-a-${i}`} name={`faq-a-${i}`} label={t("faqAnswer")} variant="secondary" rows={3} value={p.a} isDisabled={isPending} onValueChange={(v) => setPairs((cur) => cur.map((x, j) => (j === i ? { ...x, a: v } : x)))} />
                    {pairs.length > 1 ? <div className={ROW_WRAP_CLASS}><Button variant="ghost" size="sm" onPress={() => setPairs((cur) => cur.filter((_, j) => j !== i))}>{t("faqRemoveRow")}</Button></div> : null}
                  </ListItem>
                ))}
              </List>
              <div className={ROW_WRAP_CLASS}><Button variant="secondary" size="sm" onPress={() => setPairs((cur) => [...cur, { q: "", a: "" }])}>{t("faqAddRow")}</Button></div>
            </div>
          ) : null}

          {tab === "file" ? (
            <div className={STACK_CLASS}>
              <FileDropzone
                id="k-file" name="file" label={t("fileChoose")} isLabelHidden prompt={t("fileChoose")} hideFileList
                accept=".txt,.md,.markdown,text/plain,text/markdown" isDisabled={isPending} onFilesChange={(files) => { void onFile(files[0]) }}
              />
              <Text size="xs" tone="muted">{fileName ? t("fileLoaded", { name: fileName, chars: content.length.toLocaleString("vi-VN") }) : t("fileHint")}</Text>
            </div>
          ) : null}

          {tab === "url" ? (
            <Input id="k-url" name="url" label={t("urlField")} hint={t("urlHint")} variant="secondary" isDisabled={isPending} value={url} onValueChange={setUrl} />
          ) : null}

          <div className={FORM_GRID_CLASS}>
            <Select
              label={t("fieldVisibility")} variant="secondary" value={visibility} isDisabled={isPending}
              options={[{ id: "internal", label: t("visInternal") }, { id: "public", label: t("visPublic") }]}
              onValueChange={(v) => setVisibility(v === "public" ? "public" : "internal")}
            />
            <Select
              label={t("fieldModule")} variant="secondary" value={module} isDisabled={isPending}
              options={[{ id: "all", label: t("moduleAll") }, ...MODULE_KEYS.map((k) => ({ id: k, label: t(`module_${k}`) }))]}
              onValueChange={(v) => setModule(MODULE_KEYS.find((k) => k === v) ?? "all")}
            />
            <Input id="k-tags" name="tags" label={t("fieldTags")} variant="secondary" isDisabled={isPending} value={tags} onValueChange={setTags} />
          </div>

          {error !== null ? <Alert title={t("saveFailed")} description={error} tone="negative" /> : null}
          <div className={ROW_WRAP_CLASS}>
            <Button variant="primary" isPending={isPending} isDisabled={!canSave} onPress={save}>{isPending ? t("saving") : t("save")}</Button>
            <Button variant="ghost" isDisabled={isPending} onPress={onCancel}>{t("addCancel")}</Button>
          </div>
        </div>
      </Form>
    </SurfaceCard>
  )
}
