# n8n workflows for agent-studio

n8n runs in Docker (`~/Dev/tools/n8n`, http://localhost:5678), so it cannot see this repo. It relays; the Mac decides.

## approval-webhook.json
Approve link (GET `/webhook/agent-studio-approve`) -> forwards the signed query unchanged to the Mac receiver
(`http://host.docker.internal:5680/approve`) -> shows the receiver's answer. n8n never holds `APPROVAL_SECRET`.

Setup (Navin):
1. In `agent-studio/.env`: `APPROVAL_WEBHOOK_URL=http://localhost:5678/webhook/agent-studio-approve` and `APPROVAL_SECRET=<16+ random characters>`.
2. Run the receiver: `node studio/approve-server.ts --install` (LaunchAgent com.theautomationguy.approve, starts at login, log state/approve.log). Remove: `launchctl unload ~/Library/LaunchAgents/com.theautomationguy.approve.plist`.
3. n8n UI -> Import from file -> `n8n/approval-webhook.json` -> Activate. Copy the exported JSON to `~/Dev/tools/n8n/workflows/agent-studio/` if you keep workflows there.
4. Check: open a link from `node studio/approval-page.ts c1-automation <week>`; the receiver log shows `GET /approve -> 200`.

Verified 2026-10-01 on n8n 2.31.4: tampered link -> 403, signed link -> 200 through the receiver.
