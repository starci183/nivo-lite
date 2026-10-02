"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { Alert, Button, Checkbox, Dialog, Input, SectionHeader, Select, Tabs, Text, Textarea } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { content } from "@/i18n/dict/content";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { buildMediaPath, checkMediaFile } from "@/lib/video/media";
import type { ContentWorkbenchData } from "@/lib/module-content-data";
import {
  channelRule, cleanHashtags, CONTENT_CHANNELS, copyText, emptyVariant, type ContentChannel, type ContentItem, type LinkRef, type MediaRef, type Variants,
} from "@/lib/module-content-shared";
import { claimWarnings } from "@/lib/module-content-claims";
import { draftItemAction, markPublishedAction, saveItemAction, submitForApprovalAction, transitionItemAction } from "./actions";
import { CHIPS_CLASS_NAME, FORM_CLASS_NAME, FORM_ROW_CLASS_NAME, HISTORY_CLASS_NAME, MEDIA_GRID_CLASS_NAME, MEDIA_TILE_CLASS_NAME, QUOTE_CLASS_NAME, THUMB_CLASS_NAME } from "./classNames";
import { dateText, dateTimeText, timeText, toIso } from "./format";
import { StatusBadge } from "./parts";

export type EditorProps = {
  readonly item: ContentItem;
  readonly data: ContentWorkbenchData;
  readonly onClose: () => void;
};

const isImage = (m: MediaRef): boolean => m.kind === "media" && /\.(jpe?g|png|webp)$/i.test(m.path ?? "");

const MediaThumb = ({ m, urls }: { readonly m: MediaRef; readonly urls: ContentWorkbenchData["urls"] }) => {
  const key = m.kind === "video_render" ? `video:${m.id}` : (m.path ?? "");
  const url = urls[key]?.view;
  if (isImage(m) && url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={m.name} className={THUMB_CLASS_NAME} loading="lazy" />;
  }
  if (m.kind === "video_render" && url) return <video src={url} className={THUMB_CLASS_NAME} controls preload="metadata" />;
  return <div className={`${THUMB_CLASS_NAME} flex items-center justify-center`}><Text size="xs" tone="muted">{m.name}</Text></div>;
};

/** Item editor: details, the text of each channel, media, then (once approved) the "Đăng" step. Idea and draft are editable; the rest is read-only. */
export const ItemEditor = ({ item, data, onClose }: EditorProps) => {
  const t = useT(content);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [warnings, setWarnings] = useState<ReadonlyArray<string>>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const open = item.status === "idea" || item.status === "draft";
  const canManage = data.canManage;
  const editable = open && canManage;

  const [title, setTitle] = useState(item.title);
  const [brief, setBrief] = useState(item.brief);
  const [pillarId, setPillarId] = useState<string | null>(item.pillar_id);
  const [channels, setChannels] = useState<Array<ContentChannel>>([...item.channels]);
  const [date, setDate] = useState(dateText(item.scheduled_at));
  const [time, setTime] = useState(timeText(item.scheduled_at));
  const [variants, setVariants] = useState<Variants>(item.variants);
  const [tagText, setTagText] = useState<Record<string, string>>(() => Object.fromEntries(CONTENT_CHANNELS.map((c) => [c, (item.variants[c]?.hashtags ?? []).join(" ")])));
  const [media, setMedia] = useState<Array<MediaRef>>([...item.media]);
  const [links, setLinks] = useState<Array<LinkRef>>([...item.links]);
  const [hint, setHint] = useState("");
  const [tab, setTab] = useState<ContentChannel>(item.channels[0] ?? "facebook");
  const [pickLibrary, setPickLibrary] = useState(false);
  const [proof, setProof] = useState<Record<string, { url: string; how: string }>>({});

  const activeTab: ContentChannel = channels.includes(tab) ? tab : channels[0] ?? "facebook";
  const pillarName = data.pillars.find((p) => p.id === pillarId)?.name;
  const say = (tone: "ok" | "error", text: string) => setNote({ tone, text });
  const fail = (error: string) => say("error", t("actionFailed", { error }));

  const buildPatch = () => {
    const at = toIso(date, time, "19:30");
    if (at === "invalid_date") throw new Error(t("dateInvalid"));
    if (at === "invalid_time") throw new Error(t("timeInvalid"));
    const nextVariants: Variants = {};
    for (const c of channels) {
      const v = variants[c] ?? emptyVariant();
      nextVariants[c] = { ...v, hashtags: cleanHashtags((tagText[c] ?? "").split(/\s+/)) };
    }
    return { title, brief, pillarId, channels, scheduledAt: at, variants: nextVariants, links, media };
  };

  const run = (label: string, fn: () => Promise<{ ok: boolean; error?: string; after?: () => void }>) => {
    setBusy(label);
    setNote(null);
    startTransition(async () => {
      try {
        const r = await fn();
        if (r.ok) { r.after?.(); router.refresh(); } else fail(r.error ?? "");
      } catch (e) {
        fail(e instanceof Error ? e.message : "");
      }
      setBusy(null);
    });
  };

  const save = () => run("save", async () => {
    const r = await saveItemAction(item.id, buildPatch());
    return r.ok ? { ok: true, after: () => say("ok", t("saved")) } : { ok: false, error: r.error };
  });

  const draft = () => run("draft", async () => {
    // Keep what was typed (title, date, pillar...) before the AI rewrites the channel texts.
    const saved = await saveItemAction(item.id, { ...buildPatch(), variants: undefined });
    if (!saved.ok) return { ok: false, error: saved.error };
    const r = await draftItemAction(item.id, hint);
    if (!r.ok) return { ok: false, error: r.error };
    return { ok: true, after: () => { setWarnings(r.data.warnings); say("ok", t("draftReady", { s: r.data.seconds })); } };
  });

  const submit = () => run("submit", async () => {
    const saved = await saveItemAction(item.id, buildPatch());
    if (!saved.ok) return { ok: false, error: saved.error };
    const r = await submitForApprovalAction(item.id);
    return r.ok ? { ok: true, after: () => { say("ok", t("submitted")); onClose(); } } : { ok: false, error: r.error };
  });

  const transition = (kind: "skip" | "restore" | "reopen" | "delete") => run(kind, async () => {
    if (kind === "delete" && !window.confirm(t("removeConfirm"))) return { ok: true };
    const r = await transitionItemAction(item.id, kind);
    return r.ok ? { ok: true, after: () => { if (kind === "delete") onClose(); } } : { ok: false, error: r.error };
  });

  const upload = (file: File | undefined) => {
    if (!file) return;
    const check = checkMediaFile({ name: file.name, type: file.type, size: file.size });
    if (!check.ok) { fail(t("mediaUploadBad")); return; }
    run("upload", async () => {
      const path = buildMediaPath(data.workspaceId, file.name);
      const up = await supabaseBrowser().storage.from("media").upload(path, file, { contentType: file.type });
      if (up.error) return { ok: false, error: up.error.message };
      const next = [...media, { kind: "media" as const, path, name: file.name }];
      const r = await saveItemAction(item.id, { media: next });
      return r.ok ? { ok: true, after: () => setMedia(next) } : { ok: false, error: r.error };
    });
  };

  const attach = (m: MediaRef) => {
    if (media.some((x) => (x.path && x.path === m.path) || (x.id && x.id === m.id))) return;
    setMedia((cur) => [...cur, { ...m, suggested: false }]);
  };

  const copy = async (c: ContentChannel) => {
    try {
      await navigator.clipboard.writeText(copyText(item.variants[c]));
      say("ok", `${channelRule(c).label}: ${t("copied")}`);
    } catch {
      say("error", t("copyFailed"));
    }
  };

  const markPosted = (c: ContentChannel) => run(`posted-${c}`, async () => {
    const p = proof[c] ?? { url: "", how: "" };
    const r = await markPublishedAction(item.id, c, p.url, p.how);
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  });

  const live = useMemo(() => {
    const out: Array<string> = [];
    for (const c of channels) { const v = variants[c]; if (v?.text) for (const w of claimWarnings(v.text)) out.push(`${channelRule(c).label}: ${w}`); }
    return out;
  }, [channels, variants]);
  const allWarnings = [...new Set([...warnings, ...live])];
  const missingText = channels.filter((c) => !variants[c]?.text.trim());
  const libraryFree = data.library.filter((m) => !media.some((x) => x.path === m.path));
  const rule = channelRule(activeTab);
  const cur = variants[activeTab] ?? emptyVariant();
  const setVariant = (patch: Partial<typeof cur>) => setVariants((v) => ({ ...v, [activeTab]: { ...(v[activeTab] ?? emptyVariant()), ...patch } }));
  const pillarOptions = [{ id: "", label: t("noPillar") }, ...data.pillars.map((p) => ({ id: p.id, label: p.name }))];
  const videoOptions = data.videos.filter((v) => !media.some((x) => x.id === v.id)).map((v) => ({ id: v.id, label: `${v.name} · ${dateText(v.createdAt)}` }));

  return (
    <Dialog
      isOpen onOpenChange={(o) => { if (!o) onClose(); }} size="lg" title={item.title} closeLabel={t("close")}
      description={<span className={CHIPS_CLASS_NAME}><StatusBadge status={item.status} />{item.scheduled_at ? <Text as="span" size="sm" tone="muted">{dateTimeText(item.scheduled_at)}</Text> : null}{item.approved_by ? <Text as="span" size="sm" tone="muted">{t("approvedBy", { who: item.approved_by })}</Text> : null}</span>}
    >
      <div className={FORM_CLASS_NAME}>
        {note ? <Alert title={note.text} tone={note.tone === "ok" ? "affirmative" : "negative"} dismissLabel={t("close")} onDismiss={() => setNote(null)} /> : null}
        {!open && item.status !== "skipped" && item.status !== "published" ? <Text size="sm" tone="muted">{t("frozenNote")}</Text> : null}
        {item.holiday_key ? <Text size="sm" tone="muted">{t("holidayTag")}: {item.holiday_key}</Text> : null}

        <Input id="ce-title" name="title" label={t("fieldTitle")} variant="secondary" value={title} isDisabled={!editable || isPending} onValueChange={setTitle} />
        <Textarea label={t("fieldBrief")} rows={3} value={brief} isDisabled={!editable || isPending} onValueChange={setBrief} />
        <div className={FORM_ROW_CLASS_NAME}>
          <Select label={t("fieldPillar")} options={pillarOptions} value={pillarId ?? ""} isDisabled={!editable || isPending} onValueChange={(v) => setPillarId(v || null)} />
          <div className={CHIPS_CLASS_NAME} role="group" aria-label={t("fieldChannels")}>
            {CONTENT_CHANNELS.map((c) => (
              <Checkbox key={c} label={channelRule(c).label} isSelected={channels.includes(c)} isDisabled={!editable || isPending} onSelectedChange={(on) => setChannels((cur) => (on ? [...cur, c] : cur.filter((x) => x !== c)))} />
            ))}
          </div>
          <Input id="ce-date" name="date" label={t("fieldDate")} variant="secondary" value={date} hint={t("addDateHint")} isDisabled={item.status === "published" || !canManage || isPending} onValueChange={setDate} />
          <Input id="ce-time" name="time" label={t("fieldTime")} variant="secondary" value={time} hint={t("addTimeHint")} isDisabled={item.status === "published" || !canManage || isPending} onValueChange={setTime} />
        </div>

        {editable ? (
          <div className={FORM_ROW_CLASS_NAME}>
            <Input id="ce-hint" name="hint" label={t("draftHint")} variant="secondary" value={hint} isDisabled={isPending} onValueChange={setHint} />
            <div className={CHIPS_CLASS_NAME}>
              <Button variant="secondary" isPending={busy === "draft"} isDisabled={isPending || channels.length === 0} onPress={draft}>{Object.values(item.variants).some((v) => v?.text) ? t("redraft") : t("draftWithAi")}</Button>
              {busy === "draft" ? <Text size="sm" tone="muted" live="polite">{t("drafting")}</Text> : null}
            </div>
          </div>
        ) : null}

        {allWarnings.length ? (
          <Alert tone="cautionary" title={t("draftWarnTitle")} description={<ul className="m-0 list-disc pl-5">{allWarnings.map((w) => <li key={w}>{w}</li>)}</ul>} />
        ) : null}

        {channels.length ? (
          <>
            <Tabs label={t("fieldChannels")} selectedKey={activeTab} inset="none" labelVisibility="always" items={channels.map((c) => ({ id: c, label: channelRule(c).label }))} onSelect={(k) => setTab(k as ContentChannel)} />
            <div className={FORM_CLASS_NAME}>
              <Textarea label={t("variantFor", { channel: rule.label })} rows={9} value={cur.text} isDisabled={!editable || isPending} onValueChange={(v) => setVariant({ text: v })} description={t("variantChars", { n: cur.text.length, max: rule.max_chars })} />
              {rule.hashtags.max > 0 ? <Input id={`ce-tags-${activeTab}`} name={`tags-${activeTab}`} label={t("fieldHashtags")} variant="secondary" value={tagText[activeTab] ?? ""} hint={t("fieldHashtagsHint")} isDisabled={!editable || isPending} onValueChange={(v) => setTagText((x) => ({ ...x, [activeTab]: v }))} /> : null}
              <Textarea label={t("fieldNote")} rows={2} value={cur.note} isDisabled={!editable || isPending} onValueChange={(v) => setVariant({ note: v })} />
            </div>
          </>
        ) : null}

        <SectionHeader level={3} title={t("mediaTitle")} />
        {media.length === 0 ? <Text size="sm" tone="muted">{t("mediaEmpty")}</Text> : (
          <div className={MEDIA_GRID_CLASS_NAME}>
            {media.map((m, i) => (
              <div key={`${m.path ?? m.id}-${i}`} className={MEDIA_TILE_CLASS_NAME}>
                <MediaThumb m={m} urls={data.urls} />
                <Text size="xs" overflow="truncate">{m.name}</Text>
                {m.suggested ? <Text size="xs" tone="muted">{t("mediaSuggested")}</Text> : null}
                {editable ? <Button variant="ghost" size="sm" isDisabled={isPending} onPress={() => setMedia((cur) => cur.filter((_, j) => j !== i))}>{t("mediaRemove")}</Button> : null}
              </div>
            ))}
          </div>
        )}
        {editable ? (
          <div className={CHIPS_CLASS_NAME}>
            <Button variant="outline" size="sm" isDisabled={isPending} onPress={() => setPickLibrary((v) => !v)}>{t("mediaAttachLibrary")}</Button>
            <Button variant="outline" size="sm" isPending={busy === "upload"} isDisabled={isPending} onPress={() => fileRef.current?.click()}>{t("mediaUpload")}</Button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4" hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
            {videoOptions.length ? <Select label={t("mediaVideo")} isLabelHidden placeholder={t("mediaVideo")} options={videoOptions} value={null} isDisabled={isPending} onValueChange={(id) => { const v = data.videos.find((x) => x.id === id); if (v) attach({ kind: "video_render", id: v.id, name: v.name }); }} /> : null}
          </div>
        ) : null}
        {editable && pickLibrary ? (
          libraryFree.length === 0 ? <Text size="sm" tone="muted">{t("mediaLibraryEmpty")}</Text> : (
            <div className={MEDIA_GRID_CLASS_NAME}>
              {libraryFree.map((m) => (
                <button key={m.path} type="button" className={MEDIA_TILE_CLASS_NAME} onClick={() => attach(m)}>
                  <MediaThumb m={m} urls={data.urls} />
                  <Text size="xs" overflow="truncate">{m.name}</Text>
                </button>
              ))}
            </div>
          )
        ) : null}

        <SectionHeader level={3} title={t("linksTitle")} />
        {links.map((l, i) => (
          <div key={i} className={FORM_ROW_CLASS_NAME}>
            <Input id={`ce-link-${i}`} name={`link-${i}`} label={t("linkUrl")} variant="secondary" value={l.url} isDisabled={!editable || isPending} onValueChange={(v) => setLinks((cur) => cur.map((x, j) => (j === i ? { ...x, url: v } : x)))} />
            <Input id={`ce-linklabel-${i}`} name={`linklabel-${i}`} label={t("linkLabel")} variant="secondary" value={l.label} isDisabled={!editable || isPending} onValueChange={(v) => setLinks((cur) => cur.map((x, j) => (j === i ? { ...x, label: v } : x)))} />
          </div>
        ))}
        {editable ? <div className={CHIPS_CLASS_NAME}><Button variant="outline" size="sm" isDisabled={isPending} onPress={() => setLinks((cur) => [...cur, { url: "", label: "" }])}>{t("linkAdd")}</Button></div> : null}

        {item.status === "approved" || item.status === "published" ? (
          <>
            <SectionHeader level={3} title={t("postedTitle")} description={t("postedBody")} />
            {item.channels.map((c) => {
              const done = item.published[c];
              const v = item.variants[c];
              const files = media.map((m) => ({ m, url: data.urls[m.kind === "video_render" ? `video:${m.id}` : (m.path ?? "")] })).filter((x) => x.url);
              return (
                <div key={c} className="flex flex-col gap-2 rounded-lg border border-separator p-3">
                  <div className={CHIPS_CLASS_NAME}><Text weight="semibold">{channelRule(c).label}</Text><Text as="span" size="xs" tone="muted">{t("comingSoon")}</Text></div>
                  {c === "zalo" ? <Text size="xs" tone="muted">{t("zaloNote")}</Text> : null}
                  <div className={QUOTE_CLASS_NAME}><Text as="p" size="sm">{copyText(v)}</Text></div>
                  <div className={CHIPS_CLASS_NAME}>
                    <Button variant="outline" size="sm" onPress={() => void copy(c)}>{t("copy")}</Button>
                    {files.map(({ m, url }) => <Button key={m.path ?? m.id} variant="outline" size="sm" href={url.download} target="_blank" rel="noreferrer">{`${t("download")}: ${m.name}`}</Button>)}
                  </div>
                  {done ? (
                    <Text size="sm" weight="medium" live="polite">{t("postedAt", { when: dateTimeText(done.at), who: done.by })}{done.url ? ` · ${t("postedProof", { proof: done.url })}` : done.how ? ` · ${t("postedProof", { proof: done.how })}` : ""}</Text>
                  ) : canManage ? (
                    <div className={FORM_ROW_CLASS_NAME}>
                      <Input id={`ce-url-${c}`} name={`url-${c}`} label={t("postedLink")} variant="secondary" value={proof[c]?.url ?? ""} hint={t("postedLinkHint")} isDisabled={isPending} onValueChange={(x) => setProof((p) => ({ ...p, [c]: { url: x, how: p[c]?.how ?? "" } }))} />
                      <Input id={`ce-how-${c}`} name={`how-${c}`} label={t("postedHow")} variant="secondary" value={proof[c]?.how ?? ""} isDisabled={isPending} onValueChange={(x) => setProof((p) => ({ ...p, [c]: { url: p[c]?.url ?? "", how: x } }))} />
                      <Button variant="primary" size="sm" isPending={busy === `posted-${c}`} isDisabled={isPending} onPress={() => markPosted(c)}>{t("markPosted")}</Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </>
        ) : null}

        <SectionHeader level={3} title={t("evidenceTitle")} />
        {item.evidence.length === 0 ? <Text size="sm" tone="muted">{t("evidenceEmpty")}</Text> : (
          <ul className={HISTORY_CLASS_NAME}>
            {[...item.evidence].reverse().map((e, i) => <li key={`${e.at}-${i}`}><Text size="xs" tone="muted">{dateTimeText(e.at)} · {e.text}</Text></li>)}
          </ul>
        )}
        {pillarName ? <Text size="xs" tone="muted">{t("fieldPillar")}: {pillarName}</Text> : null}

        {canManage ? (
          <div className={CHIPS_CLASS_NAME}>
            {editable ? <Button variant="outline" isPending={busy === "save"} isDisabled={isPending} onPress={save}>{t("save")}</Button> : null}
            {item.status === "draft" && canManage ? <Button variant="primary" isPending={busy === "submit"} isDisabled={isPending || missingText.length > 0} onPress={submit}>{t("submit")}</Button> : null}
            {item.status === "draft" && missingText.length > 0 ? <Text size="xs" tone="muted">{t("submitNeedText")}</Text> : null}
            {item.status === "approved" ? <Button variant="outline" isPending={busy === "reopen"} isDisabled={isPending} onPress={() => transition("reopen")}>{t("reopen")}</Button> : null}
            {["idea", "draft", "approved"].includes(item.status) ? <Button variant="ghost" isPending={busy === "skip"} isDisabled={isPending} onPress={() => transition("skip")}>{t("skip")}</Button> : null}
            {item.status === "skipped" ? <Button variant="outline" isPending={busy === "restore"} isDisabled={isPending} onPress={() => transition("restore")}>{t("restore")}</Button> : null}
            {["idea", "draft", "skipped"].includes(item.status) ? <Button variant="danger-soft" isPending={busy === "delete"} isDisabled={isPending} onPress={() => transition("delete")}>{t("remove")}</Button> : null}
          </div>
        ) : null}
        {item.status === "approved" ? <Text size="xs" tone="muted">{t("reopenNote")}</Text> : null}
      </div>
    </Dialog>
  );
};
