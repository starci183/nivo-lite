"use client";

import { useState, useTransition } from "react";
import { Alert, Button } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { billing } from "@/i18n/dict/billing";
import { renewAction } from "./actions";

/** "Gia hạn": creates a payment order and moves to the QR screen (the action redirects on success). */
export const RenewButton = ({ workspaceId }: { readonly workspaceId: string }) => {
  const t = useT(billing);
  const [error, setError] = useState<string | null>(null);
  const [isPending, start] = useTransition();
  const run = () => {
    setError(null);
    start(async () => {
      const res = await renewAction(workspaceId);
      if (res && !res.ok) setError(res.error);
    });
  };
  return (
    <div>
      <Button variant="primary" isPending={isPending} onPress={run}>{isPending ? t("renewing") : t("renew")}</Button>
      {error ? <Alert tone="negative" title={t("errGeneric")} description={error} /> : null}
    </div>
  );
};
