import { notFound } from "next/navigation";
import { SettingsScreen } from "@/features/module-settings/SettingsScreen";
import { listConnections } from "@/lib/channels";
import { MODULE_PROVIDERS } from "@/lib/connections-shared";
import { isManagerRole } from "@/lib/members-shared";
import { getInstallation } from "@/lib/modules-core";
import { isModuleKey } from "@/lib/modules-shared";
import { getSession } from "@/lib/session";

type SettingsPageProps = { params: Promise<{ module: string }> };

/** Settings tab: display name, operating mode, live switch and (chatbot) the Telegram channel. */
const SettingsPage = async ({ params }: SettingsPageProps) => {
  const { module } = await params;
  if (!isModuleKey(module)) notFound();
  const [installation, session] = await Promise.all([getInstallation(module), getSession()]);
  if (!installation) notFound();
  // Non-secret facts only: the credentials never leave the server.
  const providers: ReadonlyArray<string> = MODULE_PROVIDERS[module];
  const all = (await listConnections(session.workspace.id)).filter((c) => providers.includes(c.provider));
  const options = all.filter((c) => c.status !== "disconnected" || (installation.agentId !== null && c.agentIds.includes(installation.agentId)));
  const connectionOptions = options.map((c) => ({ id: c.id, status: c.status, label: c.provider === "telegram" && c.meta.bot_username ? `${c.name} (@${c.meta.bot_username})` : c.provider === "sepay" ? `${c.name} (${c.meta.account_masked ?? ""})` : c.name }));
  const selectedConnections = installation.agentId ? all.filter((c) => c.agentIds.includes(installation.agentId as string)).map((c) => c.id) : [];
  return <SettingsScreen installation={installation} canEdit={isManagerRole(session.member.role)} connectionOptions={connectionOptions} selectedConnections={selectedConnections} />;
};

export default SettingsPage;
