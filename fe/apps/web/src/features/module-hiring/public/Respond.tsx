"use client";

import { useState } from "react";
import { Alert, Button } from "@starci/grammar/common";
import { SLOTS_CLASS_NAME } from "./classNames";

type Props =
  | { readonly kind: "slot"; readonly token: string; readonly slots: ReadonlyArray<{ readonly start: string; readonly label: string }> }
  | { readonly kind: "offer"; readonly token: string };

/** The candidate's answer on their own link: pick an interview time (or say none fits), or accept / decline an offer. Posts to /api/hiring/respond. */
export const Respond = (props: Props) => {
  const [state, setState] = useState<{ kind: "idle" | "sending" | "done" | "error"; message?: string }>({ kind: "idle" });
  const send = async (payload: Record<string, unknown>) => {
    if (state.kind === "sending") return;
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/hiring/respond", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: props.kind, token: props.token, ...payload }) });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      setState({ kind: res.ok && body.ok ? "done" : "error", message: body.message ?? "Có lỗi, vui lòng thử lại." });
    } catch {
      setState({ kind: "error", message: "Không kết nối được. Kiểm tra mạng rồi thử lại." });
    }
  };
  if (state.kind === "done") return <Alert tone="affirmative" title={state.message ?? "Đã ghi nhận."} />;
  const busy = state.kind === "sending";
  return (
    <div className={SLOTS_CLASS_NAME}>
      {props.kind === "slot" ? (
        <>
          {props.slots.map((s) => <Button key={s.start} variant="secondary" width="fill" isDisabled={busy} isPending={busy} onPress={() => void send({ start: s.start })}>{s.label}</Button>)}
          <Button variant="ghost" width="fill" isDisabled={busy} onPress={() => void send({ start: null })}>Không có giờ phù hợp</Button>
        </>
      ) : (
        <>
          <Button variant="primary" width="fill" isDisabled={busy} isPending={busy} onPress={() => void send({ accept: true })}>Tôi đồng ý nhận việc</Button>
          <Button variant="ghost" width="fill" isDisabled={busy} onPress={() => void send({ accept: false })}>Tôi xin từ chối</Button>
        </>
      )}
      {state.kind === "error" ? <Alert tone="negative" title={state.message ?? "Có lỗi, vui lòng thử lại."} urgency="assertive" /> : null}
    </div>
  );
};
