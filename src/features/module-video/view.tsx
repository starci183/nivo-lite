"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, EmptyNotice, SectionHeader, SurfaceCard, Text, type BadgeTone } from "@starci/grammar/common";
import { useLocale, useT } from "@/i18n/client";
import { video } from "@/i18n/dict/video";
import { templateOf, type Brand, type MediaItem, type ProjectStatus, type ProjectView } from "@/lib/module-video-shared";
import { archiveVideo, duplicateVideo, listVideos, type Snapshot } from "./actions";
import { BrandCard } from "./brand";
import { CARD_BODY_CLASS_NAME, CARD_CLASS_NAME, GRID_CLASS_NAME, PAGE_CLASS_NAME, ROW_CLASS_NAME, STACK_CLASS_NAME, THUMB_CLASS_NAME, THUMB_IMG_CLASS_NAME } from "./classNames";
import { Editor } from "./editor";

const STATUS_TONE: Record<ProjectStatus, BadgeTone> = { draft: "neutral", scripting: "accent", rendering: "accent", ready: "warning", approved: "success", published: "success", archived: "neutral" };

/** Props for {@link VideoWorkbenchView}. */
export type VideoWorkbenchViewProps = {
  readonly initial: Snapshot | null;
  /** Owner or manager: may create, render and approve. Others only look. */
  readonly canEdit: boolean;
};

const Card = ({ p, canEdit, busy, onOpen, onDuplicate, onArchive }: {
  readonly p: ProjectView; readonly canEdit: boolean; readonly busy: boolean; readonly onOpen: () => void; readonly onDuplicate: () => void; readonly onArchive: () => void;
}) => {
  const t = useT(video);
  const locale = useLocale();
  const r = p.render;
  return (
    <li className={CARD_CLASS_NAME}>
      <div className={THUMB_CLASS_NAME}>
        {r?.posterUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={r.posterUrl} alt={p.title} className={THUMB_IMG_CLASS_NAME} />
          : <Text as="span" size="sm" tone="muted">{r?.status === "rendering" || r?.status === "queued" ? t("status_rendering") : t("notRendered")}</Text>}
      </div>
      <div className={CARD_BODY_CLASS_NAME}>
        <Text weight="semibold" overflow="clamp-2">{p.title}</Text>
        <div className={ROW_CLASS_NAME}>
          <Badge tone={STATUS_TONE[p.status]}>{t(`status_${p.status}`)}</Badge>
          <Badge tone="neutral">{templateOf(p.goal).label[locale]}</Badge>
          <Badge tone="neutral">{p.aspect}</Badge>
        </div>
        <Text size="xs" tone="muted">
          {r?.durationMs ? t("seconds", { n: Math.round(r.durationMs / 1000) }) : t("seconds", { n: p.targetSeconds })}
          {p.renderCount > 0 ? ` · ${t("renders", { n: p.renderCount })}` : ""}
          {` · ${t("views")}: ${t("viewsNone")}`}
        </Text>
        <div className={ROW_CLASS_NAME}>
          <Button size="sm" variant="primary" onPress={onOpen}>{t("open")}</Button>
          {canEdit ? <Button size="sm" variant="secondary" isDisabled={busy} onPress={onDuplicate}>{t("duplicate")}</Button> : null}
          {canEdit ? <Button size="sm" variant="ghost" isDisabled={busy || p.status === "scripting" || p.status === "rendering"} onPress={onArchive}>{t("archive")}</Button> : null}
        </div>
      </div>
    </li>
  );
};

/** The Tạo video workbench: the library of the workspace's videos, and the wizard that makes or continues one. */
export const VideoWorkbenchView = ({ initial, canEdit }: VideoWorkbenchViewProps) => {
  const t = useT(video);
  const [projects, setProjects] = useState<ReadonlyArray<ProjectView>>(initial?.projects ?? []);
  const [brand, setBrand] = useState<Brand | null>(initial?.brand ?? null);
  const [media, setMedia] = useState<ReadonlyArray<MediaItem>>(initial?.media ?? []);
  const [open, setOpen] = useState<{ readonly project: ProjectView | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const r = await listVideos();
    if (r.ok) setProjects(r.data);
  }, []);

  // Videos still rendering or being scripted while the library is shown: look again every few seconds.
  const working = projects.some((p) => p.status === "scripting" || p.status === "rendering");
  useEffect(() => {
    if (open || !working) return;
    const id = window.setInterval(() => { void reload(); }, 4000);
    return () => window.clearInterval(id);
  }, [open, working, reload]);

  const upsert = useCallback((p: ProjectView) => setProjects((list) => (list.some((x) => x.id === p.id) ? list.map((x) => (x.id === p.id ? p : x)) : [p, ...list])), []);

  if (!initial || !brand) {
    return (
      <div className={PAGE_CLASS_NAME}>
        <SurfaceCard ariaLabel={t("loadFailedTitle")}>
          <EmptyNotice message={t("loadFailedTitle")} description={t("loadFailedBody")} />
        </SurfaceCard>
      </div>
    );
  }

  if (open) {
    return (
      <Editor
        key={open.project?.id ?? "new"} project={open.project} brand={brand} sources={initial.sources} media={media} canEdit={canEdit}
        onMedia={setMedia} onBrand={(b, m) => { setBrand(b); setMedia(m); }} onProject={upsert}
        onClose={() => { setOpen(null); void reload(); }}
      />
    );
  }

  const act = async (fn: () => Promise<{ readonly ok: boolean; readonly error?: string }>) => {
    setBusy(true);
    setError(null);
    const r = await fn();
    if (!r.ok) setError(t("actionFailed", { error: r.error ?? "" }));
    await reload();
    setBusy(false);
  };

  return (
    <div className={PAGE_CLASS_NAME}>
      <SectionHeader
        level={1} eyebrow={t("eyebrow")} title={t("title")} description={t("description")}
        action={canEdit ? <Button variant="primary" onPress={() => setOpen({ project: null })}>{t("newVideo")}</Button> : undefined}
      />
      {!canEdit ? <Alert tone="cautionary" title={t("viewOnly")} /> : null}
      {error ? <Alert tone="negative" title={error} dismissLabel={t("back")} onDismiss={() => setError(null)} /> : null}
      <div className={STACK_CLASS_NAME}>
        <Text weight="semibold" as="span">{`${t("tabLibrary")} · ${t("libraryCount", { n: projects.length })}`}</Text>
        {projects.length === 0 ? (
          <SurfaceCard ariaLabel={t("libraryEmptyTitle")}>
            <EmptyNotice
              message={t("libraryEmptyTitle")} description={t("libraryEmptyBody")}
              {...(canEdit ? { actionLabel: t("newVideo"), onAction: () => setOpen({ project: null }) } : {})}
            />
          </SurfaceCard>
        ) : (
          <ul className={GRID_CLASS_NAME} aria-label={t("tabLibrary")}>
            {projects.map((p) => (
              <Card
                key={p.id} p={p} canEdit={canEdit} busy={busy} onOpen={() => setOpen({ project: p })}
                onDuplicate={() => { void act(async () => { const r = await duplicateVideo(p.id); if (r.ok) upsert(r.data); return r; }); }}
                onArchive={() => { void act(() => archiveVideo(p.id, true)); }}
              />
            ))}
          </ul>
        )}
      </div>
      <BrandCard brand={brand} media={media} canEdit={canEdit} onSaved={(b, m) => { setBrand(b); setMedia(m); }} />
    </div>
  );
};
