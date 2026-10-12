"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { BadgeTone } from "@starci/grammar/common";
import type { ScoreLabel, Stage } from "@/lib/module-hiring-shared";
import type { Result } from "./actions";

/** Run a server action with one pending flag and one error line; refreshes the page data on success. */
export const useRunner = () => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = <T,>(fn: () => Promise<Result<T>>, onOk?: (data: T) => void): void => {
    setError(null);
    startTransition(async () => {
      const r = await fn().catch((e: unknown): Result<T> => ({ ok: false, error: e instanceof Error ? e.message : String(e) }));
      if (r.ok) {
        onOk?.(r.data);
        router.refresh();
      } else setError(r.error);
    });
  };
  return { run, isPending, error, setError };
};

export const stageTone = (s: Stage): BadgeTone =>
  s === "hired" ? "success" : s === "rejected" || s === "withdrawn" ? "danger" : s === "applied" || s === "shortlisted" ? "accent" : s === "interview" || s === "offer" ? "warning" : "neutral";

export const scoreTone = (l: ScoreLabel | null): BadgeTone => (l === "fit" ? "success" : l === "consider" ? "warning" : "neutral");

/** "5 phút trước", "3 giờ trước", "2 ngày trước". */
export const ago = (iso: string, nowIso: string): string => {
  const s = Math.max(0, (Date.parse(nowIso) - Date.parse(iso)) / 1000);
  if (s < 90) return "vừa xong";
  if (s < 3600) return `${Math.round(s / 60)} phút trước`;
  if (s < 86400) return `${Math.round(s / 3600)} giờ trước`;
  return `${Math.round(s / 86400)} ngày trước`;
};

export const copyText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

export const SOURCE_LABEL: Readonly<Record<string, string>> = { page: "Trang tuyển dụng", chat: "Chat", manual: "Thêm tay" };
