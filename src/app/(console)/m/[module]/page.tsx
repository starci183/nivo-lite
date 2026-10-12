import { notFound } from "next/navigation";
import { SetupScreen } from "@/features/module-setup/SetupScreen";
import { isManagerRole } from "@/lib/members-shared";
import { unmetRequirements } from "@/lib/module-requirements";
import { loadSetup } from "@/lib/module-actions";
import { getInstallation, listContextVersions } from "@/lib/modules-core";
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
  // The installation list is cached per request (the layout read it already), so the versions can start with the setup reads.
  const known = await getInstallation(module);
  const [state, versions, unmet] = await Promise.all([loadSetup(module), known ? listContextVersions(known.id) : Promise.resolve([]), unmetRequirements(module)]);
  if (!state.ok) notFound();
  return (
    <SetupScreen
      moduleKey={module}
      installation={state.data.installation}
      initialSession={state.data.session}
      initialRevisions={state.data.revisions}
      initialMessages={state.data.messages}
      initialVersions={versions}
      unmetRequirements={unmet}
    />
  );
};

export default SetupPage;

/** OpenClaw writes the text (setup chat, Office replies, classification), so these screens may wait longer than the platform default. */
export const maxDuration = 60;
