"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Dialog, Input } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { modulesCore } from "@/i18n/dict/modulesCore";
import { addInstance } from "@/lib/module-actions";
import { agentHref, cleanInstanceName, instanceNameKey, type ModuleKey } from "@/lib/modules-shared";
import { FORM_CLASS_NAME } from "./classNames";

type AddInstanceDialogProps = {
  readonly moduleKey: ModuleKey;
  /** The type's short name ("Chatbot AI"), used in the copy. */
  readonly typeName: string;
  /** The suggested name ("Chatbot AI 2"). */
  readonly defaultName: string;
  /** Names already used by this type (the server checks again). */
  readonly taken: ReadonlyArray<string>;
  readonly onClose: () => void;
};

/** "Thêm <loại> mới": one name field (one column, RESPONSIVE-1 case-6), then the new instance opens on its own Setup tab. */
export const AddInstanceDialog = ({ moduleKey, typeName, defaultName, taken, onClose }: AddInstanceDialogProps) => {
  const t = useT(modulesCore);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(defaultName);
  const [error, setError] = useState<string | undefined>();
  const clean = cleanInstanceName(name);
  const isTaken = clean !== null && taken.some((n) => instanceNameKey(n) === instanceNameKey(clean));
  const fieldError = clean === null ? t("instanceNameInvalid") : isTaken ? t("instanceNameTaken") : undefined;

  const create = () => {
    if (clean === null || isTaken) return;
    setError(undefined);
    startTransition(async () => {
      const result = await addInstance(moduleKey, clean);
      if (!result.ok) { setError(result.error); return; }
      router.push(agentHref(moduleKey, result.data.installationId));
    });
  };

  return (
    <Dialog
      isOpen
      onOpenChange={(open) => { if (!open && !isPending) onClose(); }}
      size="sm"
      title={t("instanceAddTitle", { type: typeName })}
      description={t("instanceAddDescription")}
      closeLabel={t("instanceCancel")}
      isDismissable={!isPending}
      footer={
        <>
          <Button variant="outline" isDisabled={isPending} onPress={onClose}>{t("instanceCancel")}</Button>
          <Button variant="primary" isPending={isPending} isDisabled={fieldError !== undefined} onPress={create}>{t("instanceCreate")}</Button>
        </>
      }
    >
      <div className={FORM_CLASS_NAME}>
        <Input
          id="agent-instance-name"
          name="name"
          label={t("instanceNameLabel")}
          hint={t("instanceNameHint", { type: typeName })}
          variant="secondary"
          isRequired
          isDisabled={isPending}
          value={name}
          onValueChange={setName}
          isError={fieldError !== undefined}
          errorMessage={fieldError}
        />
        {error !== undefined ? <Alert title={t("instanceAddFailed")} description={error} tone="negative" /> : null}
      </div>
    </Dialog>
  );
};
