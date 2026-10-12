"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, Button, Drawer, Form, Input } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { workbenchSales } from "@/i18n/dict/workbenchSales";
import { markOrderShipped } from "./actions";
import { FORM_CLASS_NAME } from "./classNames";

/** Props for {@link ShipDrawer}. */
export type ShipDrawerProps = {
  readonly isOpen: boolean;
  readonly orderId: string;
  readonly orderNo: string | null;
  readonly customer: string;
  readonly onClose: (message?: string) => void;
};

/** "Đánh dấu đã giao cho vận chuyển": the carrier and tracking code of an order. Saving announces order.shipped (the customer is told when the automation is on). */
export const ShipDrawer = ({ isOpen, orderId, orderNo, customer, onClose }: ShipDrawerProps) => {
  const t = useT(workbenchSales);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");

  const submit = () => startTransition(async () => {
    setError(null);
    const r = await markOrderShipped(orderId, { carrier, trackingCode: tracking }).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "" }));
    if (!r.ok) return setError(t("actionFailed", { error: r.error }));
    router.refresh();
    onClose(t("shipDone", { no: r.data.orderNo }));
  });

  const title = t("shipTitle");
  return (
    <Drawer isOpen={isOpen} onOpenChange={(o) => { if (!o) onClose(); }} title={title} closeLabel={t("cancel")} placement="right"
      footer={(close) => (
        <>
          <Button variant="primary" isPending={isPending} isDisabled={!carrier.trim() || !tracking.trim()} onPress={submit}>{t("shipSave")}</Button>
          <Button variant="ghost" onPress={close}>{t("cancel")}</Button>
        </>
      )}
    >
      <Form label={title} onSubmit={submit} isPending={isPending}>
        <div className={FORM_CLASS_NAME}>
          {error ? <Alert tone="negative" title={error} /> : null}
          <Alert tone="informative" title={t("shipFor", { customer, no: orderNo ?? "—" })} description={t("shipNote")} />
          <Input id="ship-carrier" name="carrier" label={t("shipCarrier")} hint={t("shipCarrierHint")} variant="secondary" value={carrier} onValueChange={setCarrier} isRequired />
          <Input id="ship-tracking" name="tracking" label={t("shipTracking")} variant="secondary" value={tracking} onValueChange={setTracking} isRequired />
        </div>
      </Form>
    </Drawer>
  );
};
