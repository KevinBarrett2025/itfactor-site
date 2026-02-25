# Phase 1 Web Update – Deployment Checklist (iT Factor)

## Files added/updated
- `index.html` (Phase 1 SEO + Founder modal)
- `privacy.html` (canonical + meta)
- `terms.html` (canonical + meta)
- `robots.txt`
- `sitemap.xml`

## Required assets
- `FounderMessage.png` (in repo root)
- `og-image.png` (1200x630) in repo root (recommended for rich shares)
- `logo.png` (already referenced)
- favicons already referenced

## After App Store approval
- Update JSON-LD `sameAs` to include your App Store URL
- Add an “App Store” chip linking to the listing
- Optionally add `apple-itunes-app` meta tag for Smart App Banner

## Cloudflare toggles (safe defaults)
- Brotli: ON
- Auto Minify (HTML/CSS/JS): ON
- HTTP/3: ON
- Early Hints: ON
- Rocket Loader: Test carefully (can break inline scripts)

