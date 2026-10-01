import { notFound } from "next/navigation";
import { SetupScreen } from "@/features/module-setup/SetupScreen";
import { isManagerRole } from "@/lib/members-shared";
import { loadSetup } from "@/lib/module-actions";
import { listContextVersions } from "@/lib/modules-core";
import { isModuleKey } from "@/lib/modules-shared";
import { getSession } from "@/lib/session";
import { getT } from "@/i18n/server";
import { access } from "@/i18n/dict/access";
import { EmptyNotice } from "@starci/grammar/common";

type SetupPageProps = { params: Promise<{ module: string }> };

/** Setup tab: the private setup chat with NIVO, the draft, the gate checklist and the versions. Owners and managers only. */
const SetupPage = async ({ params }: SetupPageProps) => {
  const { module } = await params;
  if (!isModuleKey(module)) notFound();
  const session = await getSession();
  if (!isManagerRole(session.member.role)) {
    const t = await getT(access);
    return <EmptyNotice message={t("forbidden")} />;
  }
  const state = await loadSetup(module);
  if (!state.ok) notFound();
  const versions = await listContextVersions(state.data.installation.id);
  return (
    <SetupScreen
      installation={state.data.installation}
      initialSession={state.data.session}
      initialRevisions={state.data.revisions}
      initialMessages={state.data.messages}
      initialVersions={versions}
    />
  );
};

export default SetupPage;
