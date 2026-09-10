# Crown Point talent form continuity

- Repository: /Users/kevinbarrett/Dev/SideHustle/itfactor-site
- Working checkout: /private/tmp/itfactor-crown-point-form
- Branch: gm/crown-point-size-card
- HEAD and fetched origin/main: f8c3170fcc9aa682014b77b5a9452ad121808502
- This website has no authority/main or origin/authority/main. No STS app or project file is in scope. Do not invent an STS authority branch or bypass the commit/promotion gate if its context is required.
- Objective: retain the existing size-card design at /jcp-crown-point/; add a Pages Function, server-verified Turnstile, and a private send_email Worker restricted to kevin@itfactor.studio.
- From: submissions@forms.itfactor.studio. Reply-To: validated talent email. No database, upload storage, analytics on the form, or third-party form service.
- Sending domain activated by Kevin; six records ready; all nine existing root/iCloud records unchanged. Email Preview confirmed off.
- Turnstile widget 0x4AAAAAAEuoC9HaIZDNFkb7 created in dashboard (Managed, no pre-clearance); approved hosts itfactor.studio and gm-crown-point-size-card.itfactor-site.pages.dev both confirmed. Compact client layout fits narrow phones.
- Cloudflare MCP read access works. Wrangler OAuth is active with account/user read, Workers Scripts, Pages, and Email Sending scopes only; it has no DNS or Email Routing scope.
- Controlled preview delivery passed with a real browser-generated photo. Cloudflare reported terminal `delivered`; the message arrived in Kevin's iCloud mailbox with one valid JPEG attachment and `Reply-To: kevin@rheirhome.com`. The private Worker was returned to its disabled state afterward. No production Pages deployment has occurred.
- Preserve unrelated original-checkout RHEIR/Client/LisaAlexander/index.html modification; do not open, stage, or deploy it. No Birdman/Visibility/Apple Intelligence/Zombly/STS edits.
- Private configuration receipt: /private/tmp/crown-point-email-dns-proposal.md (outside Git).

## Local implementation and verification — September 10, 2026

- Original draft retained and moved to jcp-crown-point/. Added strict Pages config/submit endpoints, shared validation, and a private recipient-restricted mailer under cloudflare/crown-point-mailer/. Its current deployed version is disabled and has no public route.
- Source changes: .gitignore; this continuity file; _headers; _routes.json; wrangler.toml; functions/_lib/crown-point.mjs; functions/jcp-crown-point/config.js; functions/jcp-crown-point/submit.js; cloudflare/crown-point-mailer/worker.mjs; cloudflare/crown-point-mailer/wrangler.jsonc; jcp-crown-point/index.html; jcp-crown-point/form.css; jcp-crown-point/form.js; jcp-crown-point/thank-you/index.html; scripts/crown-point-test.mjs.
- Node unit tests: 29/29 PASS, including byte-for-byte binary attachment preservation. These tests use mocked providers and are distinct from the inbox-delivery evidence below.
- Cloudflare Wrangler 4.130.0 Pages Functions build: PASS. Worker deploy --dry-run: PASS; output confirms kevin@itfactor.studio destination and submissions@forms.itfactor.studio sender restrictions. Build artifacts are outside Git under /private/tmp/crown-point-pages-build and /private/tmp/crown-point-mailer-build.
- Isolated browser QA: PASS at 1440/390/320 pixels, zero horizontal overflow, labeled inputs, guardian check, photo compression to 134083 bytes, preservation after provider/network failures, acceptance-only success, no-JavaScript explanation. All requests intercepted locally; zero actual emails.
- Screenshots: /private/tmp/crown-point-local-1440.png, /private/tmp/crown-point-local-390.png, /private/tmp/crown-point-local-320.png, /private/tmp/crown-point-local-success.png, /private/tmp/crown-point-local-nojs.png.
- git diff --check and JavaScript syntax checks PASS. No project.pbxproj exists in the changed scope; drift NONE. Original checkout still shows only the unrelated RHEIR modification.
- Controlled end-to-end evidence: Pages preview deployment 47bd7603-058f-44a0-831d-c4e8d11c7422 accepted the browser submission; active test Worker version 71f17b68-b70a-41ab-852d-08d9c534b48b sent message ID <NOsm1T3fuxTCiQDuGABK5vBM55CgXAkZfTCw@forms.itfactor.studio>; Cloudflare recorded terminal `delivered` at 2026-09-10T06:15:17Z. Apple Mail received the exact From/To/Reply-To headers and one `talent-photo.jpg`; the extracted 1103x1426 sRGB JPEG passed `file` and `sips` validation with SHA-256 7b5e1ddb41ab9489f76b63c8ad3722c435a31c89b025ad75e8e770317151baad. Private proof copy: /private/tmp/crown-point-e2e-received.jpg.
- After the test, the private Worker was redeployed disabled as version 6c4b6ba4-3f26-4fec-b3b1-117735ee0597. Email Preview remains off. No test data is in Git.
- This website has no `authority/main` refs or STS spine/Gate A/parity runbook; do not claim STS app gates or invent an authority branch. The established website path is scoped feature commit/push, Cloudflare preview verification, then conflict-checked fast-forward of `main` for the authorized Pages production deployment.
- GitHub preview deployment b074eeec-a21b-4527-bf49-b4a91f056bd7 for commit 6049e5f640eae0f9292425afcc01f937b8bc3f54 succeeded. Cloudflare assigned the stable branch alias `gm-crown-point-size-card-s77a.itfactor-site.pages.dev`; that exact alias was added to the server and Turnstile allowlists rather than permitting arbitrary Pages preview hosts.
- The production environment is enabled in source only after the end-to-end gate passed; it still fails closed unless Cloudflare supplies both the encrypted Turnstile secret and private service binding. Never place the secret in Git.
- Remaining acceptance gates: commit the isolated scope, verify the branch preview, configure the production Pages bindings without exposing the Turnstile secret, integrate only if `origin/main` remains non-overlapping, enable the private Worker, monitor the production Pages deployment, and verify the live form plus unrelated-site regressions.
