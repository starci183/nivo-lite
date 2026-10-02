"use client";

import { useState } from "react";
import { Alert, Button, FileDropzone, Input, Select, SurfaceCard, Text } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { video } from "@/i18n/dict/video";
import { MUSIC_TRACKS } from "@/lib/video/spec";
import type { Brand, MediaItem } from "@/lib/module-video-shared";
import { refreshMedia, saveBrandKit } from "./actions";
import { COLOR_CLASS_NAME, FIELD_ROW_CLASS_NAME, LOGO_CLASS_NAME, ROW_CLASS_NAME, STACK_CLASS_NAME, STACK_SM_CLASS_NAME } from "./classNames";
import { uploadMedia } from "./upload";

/** Props for {@link BrandCard}. */
export type BrandCardProps = {
  readonly brand: Brand;
  readonly media: ReadonlyArray<MediaItem>;
  readonly canEdit: boolean;
  readonly onSaved: (brand: Brand, media: ReadonlyArray<MediaItem>) => void;
};

const NO_MUSIC = "none";

/** The brand kit: shop name, two colours, logo, background music and voice. Used by every video of the workspace. */
export const BrandCard = ({ brand, media, canEdit, onSaved }: BrandCardProps) => {
  const t = useT(video);
  const [draft, setDraft] = useState<Brand>(brand);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ readonly tone: "affirmative" | "negative"; readonly text: string } | null>(null);
  const logo = draft.logoPath ? media.find((m) => m.path === draft.logoPath) : null;
  const set = (patch: Partial<Brand>) => setDraft((d) => ({ ...d, ...patch }));

  const pickLogo = async (files: ReadonlyArray<File>) => {
    const file = files[0];
    if (!file) return;
    setPending(true);
    const r = await uploadMedia([file]);
    if (r.errors[0]) setMessage({ tone: "negative", text: t("uploadFailed", { name: r.errors[0].name, error: r.errors[0].error }) });
    else if (r.paths[0]) {
      const m = await refreshMedia();
      set({ logoPath: r.paths[0] });
      if (m.ok) onSaved(draft, m.data);
    }
    setPending(false);
  };

  const save = async () => {
    setPending(true);
    setMessage(null);
    const r = await saveBrandKit(draft);
    if (r.ok) {
      setDraft(r.data);
      setMessage({ tone: "affirmative", text: t("brandSaved") });
      onSaved(r.data, media);
    } else setMessage({ tone: "negative", text: t("actionFailed", { error: r.error }) });
    setPending(false);
  };

  return (
    <SurfaceCard label={t("brandTitle")} fact={t("brandHint")}>
      <div className={STACK_CLASS_NAME}>
        <Input id="video-shop-name" name="shopName" label={t("shopName")} variant="secondary" value={draft.shopName} isDisabled={!canEdit || pending} onValueChange={(v) => set({ shopName: v })} />
        <div className={FIELD_ROW_CLASS_NAME}>
          <div className={STACK_SM_CLASS_NAME}>
            <Text as="span" size="sm" weight="medium">{t("primary")}</Text>
            <input type="color" aria-label={t("primary")} className={COLOR_CLASS_NAME} value={draft.primary} disabled={!canEdit || pending} onChange={(e) => set({ primary: e.target.value })} />
          </div>
          <div className={STACK_SM_CLASS_NAME}>
            <Text as="span" size="sm" weight="medium">{t("secondary")}</Text>
            <input type="color" aria-label={t("secondary")} className={COLOR_CLASS_NAME} value={draft.secondary} disabled={!canEdit || pending} onChange={(e) => set({ secondary: e.target.value })} />
          </div>
          <div className={STACK_SM_CLASS_NAME}>
            <Text as="span" size="sm" weight="medium">{t("logo")}</Text>
            <div className={ROW_CLASS_NAME}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {logo?.url ? <img src={logo.url} alt={t("logo")} className={LOGO_CLASS_NAME} /> : <Text as="span" size="xs" tone="muted">{t("logoNone")}</Text>}
              {canEdit ? <FileDropzone label={t("logoUpload")} isLabelHidden accept="image/png,image/jpeg,image/webp" hideFileList isDisabled={pending} prompt={t("logoUpload")} onFilesChange={(files) => { void pickLogo(files); }} /> : null}
              {canEdit && draft.logoPath ? <Button size="sm" variant="ghost" isDisabled={pending} onPress={() => set({ logoPath: null })}>{t("logoRemove")}</Button> : null}
            </div>
          </div>
        </div>
        <div className={FIELD_ROW_CLASS_NAME}>
          <Select
            label={t("music")} value={draft.musicTrack ?? NO_MUSIC} isDisabled={!canEdit || pending}
            options={[{ id: NO_MUSIC, label: t("musicNone") }, ...MUSIC_TRACKS.map((m) => ({ id: m.id, label: m.label }))]}
            onValueChange={(v) => set({ musicTrack: v && v !== NO_MUSIC ? v : null })}
          />
          <Select
            label={t("voice")} value={draft.voice} isDisabled={!canEdit || pending}
            options={[{ id: "vi-VN-HoaiMyNeural", label: t("voice_f") }, { id: "vi-VN-NamMinhNeural", label: t("voice_m") }]}
            onValueChange={(v) => set({ voice: v ?? draft.voice })}
          />
        </div>
        {message ? <Alert tone={message.tone} title={message.text} /> : null}
        {canEdit ? <div className={ROW_CLASS_NAME}><Button variant="primary" isPending={pending} onPress={() => { void save(); }}>{t("saveBrand")}</Button></div> : null}
      </div>
    </SurfaceCard>
  );
};
