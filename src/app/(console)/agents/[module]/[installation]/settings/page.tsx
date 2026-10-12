import { notFound } from "next/navigation";
import { SettingsScreen } from "@/features/module-settings/SettingsScreen";
import { listConnections } from "@/lib/channels";
import { isDataProvider, purposeFor } from "@/lib/connection-access";
import { MODULE_PROVIDERS } from "@/lib/connections-shared";
import { isManagerRole } from "@/lib/members-shared";
import { getInstallationById } from "@/lib/modules-core";
import { isModuleKey } from "@/lib/modules-shared";
import { getSession } from "@/lib/session";

type SettingsPageProps = { params: Promise<{ module: string; installation: string }> };

/** Settings tab: display name, operating mode, live switch and (chatbot) the Telegram channel. */
const SettingsPage = async ({ params }: SettingsPageProps) => {
  const { module, installation: installationId } = await params;
  if (!isModuleKey(module)) notFound();
  const [installation, session] = await Promise.all([getInstallationById(installationId), getSession()]);
  if (!installation || installation.moduleKey !== module) notFound();
  // Non-secret facts only: the credentials never leave the server. The connections this module's agent can use follow the same
  // rule as the Connections page picker (purposeFor), narrowed to the providers the module declares (connection_providers in
  // resources/modules/<key>/module.json) plus the data connectors every agent may read, so both directions offer the same pairs.
  const all = (await listConnections(session.workspace.id)).filter((c) => purposeFor(module, c.provider) !== null && (isDataProvider(c.provider) || MODULE_PROVIDERS[module].includes(c.provider)));
  const options = all.filter((c) => c.status !== "disconnected" || (installation.agentId !== null && c.agentIds.includes(installation.agentId)));
  const agentId = installation.agentId;
  const connectionOptions = options.map((c) => ({ id: c.id, status: c.status, purpose: purposeFor(module, c.provider), access: agentId ? (c.grants.find((g) => g.agentId === agentId)?.access ?? null) : null, label: c.provider === "telegram" && c.meta.bot_username ? `${c.name} (@${c.meta.bot_username})` : (c.provider === "sepay" || c.provider === "casso") && c.meta.account_masked ? `${c.name} (${c.meta.account_masked ?? ""})` : c.name }));
  const selectedConnections = installation.agentId ? all.filter((c) => c.agentIds.includes(installation.agentId as string)).map((c) => c.id) : [];
  return <SettingsScreen moduleKey={module} installation={installation} canEdit={isManagerRole(session.member.role)} canGrant={session.member.role === "owner"} connectionOptions={connectionOptions} selectedConnections={selectedConnections} />;
};

export default SettingsPage;
