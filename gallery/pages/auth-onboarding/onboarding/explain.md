---
title: Onboarding cũ (/onboarding)
route: /onboarding
area: auth-onboarding
---
# /onboarding

The old entry point: `OnboardingRedirectPage` forwards to `/workspaces`, so the shot is the workspaces list. Superseded by `workspaces` (same screen); there is no separate onboarding UI left. Shots `1440.png`, `390.png`. Grammar paths under `node_modules/@starci/grammar/dist/core/`.

## Toàn trang (chuyển hướng tới /workspaces)
Vì sao: SAI — a route that exists only to redirect should not have its own page entry; keep it as a redirect and delete the shot folder, or the redirect proves the first-run flow lives at `/workspaces/new`. Regions are those of `workspaces/explain.md` (count not a chip, icon on sm "Mở", loose caption under the join card).
Luật: `verify-against-visualize.md`, `table-heroui-native-section-head.md`.
Grammar: `WorkspaceShell`, `node_modules/@starci/grammar/dist/core/frame/WorkspaceShell/index.d.ts`.
