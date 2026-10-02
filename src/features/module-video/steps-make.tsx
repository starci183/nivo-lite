"use client";

import { Alert, Badge, Button, Progress, Select, SurfaceCard, Text, Textarea } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { video } from "@/i18n/dict/video";
import type { Locale } from "@/i18n/core";
import { estimateScriptSeconds, newScene, type Brand, type MediaItem, type ProjectView, type SceneRole, type ScriptScene } from "@/lib/module-video-shared";
import {
  FOOTER_CLASS_NAME, FRAME_CARD_TEXT_CLASS_NAME, FRAME_CLASS_NAME, FRAME_TEXT_CLASS_NAME, MEDIA_IMG_CLASS_NAME, PLAYER_CLASS_NAME, ROW_CLASS_NAME, SCENE_CLASS_NAME, SCENE_HEAD_CLASS_NAME,
  STACK_CLASS_NAME, STACK_SM_CLASS_NAME, STORYBOARD_CLASS_NAME,
} from "./classNames";

const NONE = "none";
const MAX_SECONDS = 90;
const ratio = (aspect: string): string => (aspect === "9:16" ? "9 / 16" : aspect === "1:1" ? "1 / 1" : "16 / 9");
const ROLE_TONE: Record<SceneRole, "accent" | "neutral" | "success"> = { hook: "accent", body: "neutral", cta: "success" };

/* ------------------------------------------------------------------ step 3: the script */

export const ScriptStep = (p: {
  readonly project: ProjectView; readonly scenes: ReadonlyArray<ScriptScene>; readonly media: ReadonlyArray<MediaItem>; readonly canEdit: boolean; readonly dirty: boolean;
  readonly writing: boolean; readonly saving: boolean;
  readonly onScenes: (s: ReadonlyArray<ScriptScene>) => void; readonly onWrite: () => void; readonly onBack: () => void; readonly onNext: () => void;
}) => {
  const t = useT(video);
  const off = !p.canEdit || p.writing;
  const edit = (i: number, patch: Partial<ScriptScene>) => p.onScenes(p.scenes.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= p.scenes.length) return;
    const next = [...p.scenes];
    [next[i], next[j]] = [next[j], next[i]];
    p.onScenes(next);
  };
  const total = estimateScriptSeconds(p.scenes);
  const mediaOptions = [{ id: NONE, label: t("mediaNone") }, ...p.media.map((m) => ({ id: m.path, label: m.name }))];
  return (
    <div className={STACK_CLASS_NAME}>
      <SurfaceCard label={t("scriptHeading")} fact={p.project.scriptMs ? t("scriptTook", { s: (p.project.scriptMs / 1000).toFixed(0) }) : undefined}>
        <div className={STACK_CLASS_NAME}>
          {p.writing ? <Alert tone="informative" title={t("scripting")} /> : null}
          {p.scenes.length === 0 && !p.writing ? <Text size="sm" tone="muted">{t("scriptEmpty")}</Text> : null}
          <div className={ROW_CLASS_NAME}>
            <Button variant={p.scenes.length ? "secondary" : "primary"} isPending={p.writing} isDisabled={!p.canEdit} onPress={p.onWrite}>{p.scenes.length ? t("rewriteScript") : t("writeScript")}</Button>
            {p.scenes.length && p.dirty ? <Text as="span" size="xs" tone="muted">{t("rewriteWarn")}</Text> : null}
          </div>
        </div>
      </SurfaceCard>

      {p.scenes.map((s, i) => (
        <section key={s.id} className={SCENE_CLASS_NAME} aria-label={t("sceneN", { n: i + 1 })}>
          <div className={SCENE_HEAD_CLASS_NAME}>
            <div className={ROW_CLASS_NAME}>
              <Text as="span" weight="semibold">{t("sceneN", { n: i + 1 })}</Text>
              <Badge tone={ROLE_TONE[s.role]}>{t(`role_${s.role}`)}</Badge>
            </div>
            <div className={ROW_CLASS_NAME}>
              <Button size="sm" variant="ghost" isDisabled={off || i === 0} onPress={() => move(i, -1)}>{t("moveUp")}</Button>
              <Button size="sm" variant="ghost" isDisabled={off || i === p.scenes.length - 1} onPress={() => move(i, 1)}>{t("moveDown")}</Button>
              <Button size="sm" variant="danger-soft" isDisabled={off || p.scenes.length <= 1} onPress={() => p.onScenes(p.scenes.filter((_, k) => k !== i))}>{t("removeScene")}</Button>
            </div>
          </div>
          <Textarea label={t("captionLabel")} rows={2} maxLength={160} value={s.caption} isDisabled={off} onValueChange={(v) => edit(i, { caption: v })} />
          <Textarea label={t("voiceLabel")} rows={3} maxLength={420} value={s.voiceover} isDisabled={off} onValueChange={(v) => edit(i, { voiceover: v })} />
          {s.visual ? <Text size="xs" tone="muted">{t("visualHint", { text: s.visual })}</Text> : null}
          <Select
            label={t("mediaPick")} value={s.media ?? NONE} options={mediaOptions} isDisabled={off}
            onValueChange={(v) => edit(i, { media: v && v !== NONE ? v : null })}
          />
        </section>
      ))}

      {p.canEdit ? <div className={ROW_CLASS_NAME}><Button variant="outline" isDisabled={off || p.scenes.length >= 12} onPress={() => p.onScenes([...p.scenes, newScene(p.scenes.length ? "body" : "hook")])}>{t("addScene")}</Button></div> : null}

      <div className={FOOTER_CLASS_NAME}>
        <Button variant="ghost" isDisabled={p.saving} onPress={p.onBack}>{t("back")}</Button>
        <div className={ROW_CLASS_NAME}>
          {p.scenes.length ? <Text as="span" size="sm" tone="muted">{total > MAX_SECONDS ? t("tooLong") : t("estimated", { n: total })}</Text> : null}
          <Button variant="primary" isPending={p.saving} isDisabled={off || p.scenes.length === 0 || total > MAX_SECONDS} onPress={p.onNext}>{t("next")}</Button>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ step 4: storyboard + render */

const Frame = ({ scene, media, brand, aspect, index }: { readonly scene: ScriptScene; readonly media: ReadonlyArray<MediaItem>; readonly brand: Brand; readonly aspect: string; readonly index: number }) => {
  const m = scene.media ? media.find((x) => x.path === scene.media) : null;
  const dark = index % 2 === 1;
  const bg = { background: `linear-gradient(160deg, ${dark ? brand.secondary : brand.primary}, ${dark ? brand.primary : brand.secondary})` };
  return (
    <div className={FRAME_CLASS_NAME} style={{ height: aspect === "16:9" ? 108 : 176, aspectRatio: ratio(aspect), ...(m?.url ? {} : bg) }}>
      {m?.url ? (m.kind === "image"
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={m.url} alt={m.name} className={MEDIA_IMG_CLASS_NAME} />
        : <video src={`${m.url}#t=0.5`} preload="metadata" muted playsInline aria-label={m.name} className={MEDIA_IMG_CLASS_NAME} />) : null}
      {m?.url ? <div className={`${FRAME_TEXT_CLASS_NAME} absolute bottom-0 left-0`}>{scene.caption}</div> : <div className={FRAME_CARD_TEXT_CLASS_NAME}>{scene.caption}</div>}
    </div>
  );
};

const STAGES = new Set(["tts", "scenes", "mix", "encode", "upload"]);

export const PreviewStep = (p: {
  readonly project: ProjectView; readonly scenes: ReadonlyArray<ScriptScene>; readonly media: ReadonlyArray<MediaItem>; readonly brand: Brand; readonly canEdit: boolean; readonly rendering: boolean;
  readonly onBack: () => void; readonly onRender: () => void;
}) => {
  const t = useT(video);
  const r = p.project.render;
  const live = p.project.status === "rendering";
  const stage = r?.stage && STAGES.has(r.stage) ? t(`stage_${r.stage as "tts"}`) : t("stage_queued");
  const total = estimateScriptSeconds(p.scenes);
  return (
    <div className={STACK_CLASS_NAME}>
      <SurfaceCard label={t("storyboardHeading")} fact={t("estimated", { n: total })}>
        <div className={STACK_CLASS_NAME}>
          <Text size="xs" tone="muted">{t("storyboardHint")}</Text>
          <ol className={STORYBOARD_CLASS_NAME} aria-label={t("storyboardHeading")}>
            {p.scenes.map((s, i) => (
              <li key={s.id} className={STACK_SM_CLASS_NAME}>
                <Frame scene={s} media={p.media} brand={p.brand} aspect={p.project.aspect} index={i} />
                <Text as="span" size="xs" tone="muted">{t("sceneN", { n: i + 1 })}</Text>
              </li>
            ))}
          </ol>
        </div>
      </SurfaceCard>
      {live ? (
        <SurfaceCard label={t("rendering")} fact={stage}>
          <Progress label={t("progressLabel")} value={r?.progress ?? 0} />
        </SurfaceCard>
      ) : <Text size="sm" tone="muted">{t("renderNote")}</Text>}
      <div className={FOOTER_CLASS_NAME}>
        <Button variant="ghost" isDisabled={p.rendering} onPress={p.onBack}>{t("back")}</Button>
        <Button variant="primary" isPending={p.rendering} isDisabled={!p.canEdit || p.scenes.length === 0 || total > MAX_SECONDS} onPress={p.onRender}>{p.project.renderCount > 0 ? t("rerender") : t("render")}</Button>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ step 5: the result */

export const ResultStep = (p: {
  readonly project: ProjectView; readonly canEdit: boolean; readonly busy: string | null; readonly locale: Locale; readonly seconds: number;
  readonly onApprove: () => void; readonly onShare: () => void; readonly onPosted: () => void; readonly onEdit: () => void; readonly onRerender: () => void;
}) => {
  const t = useT(video);
  const r = p.project.render;
  const approved = p.project.status === "approved" || p.project.status === "published";
  const sizeMb = r?.sizeBytes ? (r.sizeBytes / 1_048_576).toFixed(1) : null;
  return (
    <div className={STACK_CLASS_NAME}>
      <SurfaceCard label={t("resultHeading")} fact={`${t("version", { n: p.project.renderCount })} · ${t(`status_${p.project.status}`)}`}>
        <div className={STACK_CLASS_NAME}>
          {r?.videoUrl ? (
            <video controls playsInline preload="metadata" poster={r.posterUrl ?? undefined} src={r.videoUrl} className={PLAYER_CLASS_NAME} style={{ aspectRatio: ratio(p.project.aspect) }} aria-label={p.project.title} />
          ) : r?.status === "failed" ? <Alert tone="negative" title={t("renderFailed")} description={r.error ?? undefined} /> : <Text size="sm" tone="muted">{t("status_rendering")}</Text>}
          <div className={ROW_CLASS_NAME}>
            {r?.durationMs ? <Badge tone="neutral">{t("seconds", { n: Math.round(r.durationMs / 1000) })}</Badge> : null}
            {sizeMb ? <Badge tone="neutral">{t("fileSize", { n: sizeMb })}</Badge> : null}
            <Badge tone="neutral">{p.project.aspect}</Badge>
            {approved ? <Badge tone="success">{p.project.approvedByName ? t("approvedBy", { name: p.project.approvedByName }) : t(`status_${p.project.status}`)}</Badge> : null}
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard label={approved ? t("status_approved") : t("approve")}>
        <div className={STACK_CLASS_NAME}>
          {!approved ? <Text size="sm" tone="muted">{t("approveHelp")}</Text> : null}
          <div className={ROW_CLASS_NAME}>
            {!approved ? <Button variant="primary" isPending={p.busy === "approve"} isDisabled={!p.canEdit || p.project.status !== "ready"} onPress={p.onApprove}>{t("approve")}</Button> : null}
            {approved && r?.downloadUrl ? <Button variant="primary" href={r.downloadUrl} download>{t("download")}</Button> : null}
            {approved ? <Button variant="secondary" isPending={p.busy === "share"} isDisabled={!p.canEdit} onPress={p.onShare}>{t("share")}</Button> : null}
            {p.project.status === "approved" ? <Button variant="outline" isPending={p.busy === "posted"} isDisabled={!p.canEdit} onPress={p.onPosted}>{t("markPublished")}</Button> : null}
          </div>
          <div className={ROW_CLASS_NAME} aria-label={t("soon")}>
            <Button variant="outline" isDisabled endContent={<Badge tone="warning">{t("soon")}</Badge>}>{t("postTikTok")}</Button>
            <Button variant="outline" isDisabled endContent={<Badge tone="warning">{t("soon")}</Badge>}>{t("postFacebook")}</Button>
          </div>
          <Text size="xs" tone="muted">{t("postNote")}</Text>
        </div>
      </SurfaceCard>

      <div className={FOOTER_CLASS_NAME}>
        <div className={STACK_SM_CLASS_NAME}>
          <Button variant="ghost" isDisabled={!p.canEdit} onPress={p.onEdit}>{t("editAgain")}</Button>
          {approved ? <Text size="xs" tone="muted">{t("approvedLocked")}</Text> : null}
        </div>
        <Button variant="ghost" isDisabled={!p.canEdit || p.project.status === "rendering"} onPress={p.onRerender}>{t("rerender")}</Button>
      </div>
    </div>
  );
};
