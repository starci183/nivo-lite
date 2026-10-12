"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, Badge, Text, type BadgeTone } from "@starci/grammar/common";
import type { PoStatus, StockStatus } from "@/lib/module-inventory-shared";
import type { Outcome } from "@/lib/types";

/** Plain Vietnamese words of the module. */
export const STOCK_LABEL: Readonly<Record<StockStatus, string>> = { out: "Hết hàng", low: "Sắp hết", ok: "Đủ dùng", over: "Dư nhiều" };
export const STOCK_TONE: Readonly<Record<StockStatus, BadgeTone>> = { out: "danger", low: "warning", ok: "success", over: "neutral" };

export const PO_LABEL: Readonly<Record<PoStatus, string>> = {
  draft: "Nháp", waiting_approval: "Chờ duyệt", sent: "Đã gửi", partially_received: "Nhận một phần", received: "Đã nhận đủ", cancelled: "Đã huỷ",
};
export const PO_TONE: Readonly<Record<PoStatus, BadgeTone>> = { draft: "neutral", waiting_approval: "warning", sent: "accent", partially_received: "accent", received: "success", cancelled: "neutral" };

export const MOVE_LABEL: Readonly<Record<string, string>> = { in: "Nhập", out: "Xuất", adjust: "Chỉnh", transfer: "Chuyển" };
export const MOVE_TONE: Readonly<Record<string, BadgeTone>> = { in: "success", out: "neutral", adjust: "warning", transfer: "accent" };

export const StockBadge = ({ status }: { readonly status: StockStatus }) => <Badge tone={STOCK_TONE[status]} isDot>{STOCK_LABEL[status]}</Badge>;
export const PoBadge = ({ status }: { readonly status: PoStatus }) => <Badge tone={PO_TONE[status]} isDot>{PO_LABEL[status]}</Badge>;

export const formatDate = (iso: string | null): string => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
export const formatStamp = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(d);
};

/** Run a server action: pending flag, one plain error line, and a refresh of the server data after success. */
export const useRun = () => {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const exec = <T,>(fn: () => Promise<Outcome<T>>, onOk?: (data: T) => string | void): void => {
    setError(null);
    setNotice(null);
    start(async () => {
      const r = await fn().catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Có lỗi, thử lại sau." }));
      if (r.ok) {
        const msg = onOk?.(r.data);
        if (typeof msg === "string") setNotice(msg);
        router.refresh();
      } else setError(r.error);
    });
  };
  return { exec, isPending, error, notice, setError, setNotice };
};

export const Feedback = ({ error, notice }: { readonly error: string | null; readonly notice: string | null }) =>
  error ? <Alert tone="negative" title={error} /> : notice ? <Alert tone="affirmative" title={notice} /> : null;

export const Muted = ({ children }: { readonly children: React.ReactNode }) => <Text size="sm" tone="muted">{children}</Text>;
