# Custom domain: em.adriansliacky.sk

The application is live on a custom domain while remaining hosted on GitHub
Pages.

| | |
| --- | --- |
| **Live URL** | **<https://em.adriansliacky.sk/>** |
| DNS record | `CNAME em → adrian-sliacky-gymzv.github.io` |
| DNS provider | Cloudflare |
| Proxy status | **DNS only** (grey cloud) |
| GitHub Pages custom domain | `em.adriansliacky.sk` |
| HTTPS | Certificate approved; **Enforce HTTPS** enabled |
| CNAME file | `webapp/CNAME` |

## How it works

A custom domain is a DNS mapping, not a browser redirect.

1. A visitor opens `https://em.adriansliacky.sk/`.
2. Cloudflare resolves the CNAME to `adrian-sliacky-gymzv.github.io`.
3. The browser connects to GitHub Pages using the custom hostname.
4. GitHub Pages serves this repository and presents a TLS certificate for
   `em.adriansliacky.sk`.
5. The address bar stays on **`em.adriansliacky.sk`**. Internal links use
   relative paths, so navigation stays on the custom domain.

The default Pages URL
`https://adrian-sliacky-gymzv.github.io/editor-map-2-web/` redirects to the
custom domain. That is GitHub Pages behaviour, not DNS.

## Current Cloudflare record

Cloudflare → `adriansliacky.sk` → **DNS → Records**:

| Type | Name | Target | Proxy status | TTL |
| --- | --- | --- | --- | --- |
| CNAME | `em` | `adrian-sliacky-gymzv.github.io` | **DNS only** | Auto |

Keep it **DNS only**. If you later enable the orange-cloud proxy, use
SSL/TLS mode **Full (strict)** and verify that GitHub’s certificate and
redirects still work. DNS only is the simplest and most reliable setup.

## GitHub Pages settings

Repository → **Settings → Pages**:

- **Source:** GitHub Actions
- **Custom domain:** `em.adriansliacky.sk`
- **Enforce HTTPS:** enabled

`webapp/CNAME` contains:

```text
em.adriansliacky.sk
```

The file is part of the deployed site and keeps the custom domain attached
across future deployments.

## Verification

```powershell
Resolve-DnsName em.adriansliacky.sk -Type CNAME
Invoke-WebRequest -UseBasicParsing https://em.adriansliacky.sk/
```

Expected: the CNAME resolves to `adrian-sliacky-gymzv.github.io`, and HTTPS
returns HTTP 200.

## Using the bare domain instead

If you later want `https://adriansliacky.sk/` rather than the `em` subdomain:

1. In Cloudflare, remove the `em` record if it is no longer needed.
2. Add these apex records, all **DNS only**:

| Type | Name | Value |
| --- | --- | --- |
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| AAAA | `@` | `2606:50c0:8000::153` |
| AAAA | `@` | `2606:50c0:8001::153` |
| AAAA | `@` | `2606:50c0:8002::153` |
| AAAA | `@` | `2606:50c0:8003::153` |

3. Add `CNAME www → adrian-sliacky-gymzv.github.io` (DNS only). Remove
   conflicting `@` or `www` records first.
4. Change `webapp/CNAME` to `adriansliacky.sk`.
5. Change the GitHub Pages custom domain to `adriansliacky.sk`.
6. Wait for the certificate, then keep **Enforce HTTPS** enabled.

Cloudflare also supports a flattened CNAME at the apex, but the A/AAAA values
above follow GitHub’s documented setup directly.

## Notes

- DNS changes can take a few minutes to propagate.
- GitHub usually issues the TLS certificate within minutes; the certificate
  currently expires on **2027-02-08** and renews automatically.
- Keep unrelated MX/TXT records for email; only replace records that conflict
  with the website hostname.
- Do not use Cloudflare’s “Always Use HTTPS” until GitHub has issued the
  certificate.
