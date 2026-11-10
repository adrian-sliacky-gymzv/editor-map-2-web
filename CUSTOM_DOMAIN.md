# Using adriansliacky.sk with GitHub Pages

Yes. GitHub Pages supports custom domains, including a custom domain on a
project site such as this one. The current GitHub Pages URL will continue to
work while DNS is being prepared; only switch the GitHub Pages custom-domain
setting after the DNS records below are in place.

The domain `adriansliacky.sk` currently uses Cloudflare nameservers
(`laila.ns.cloudflare.com` and `michael.ns.cloudflare.com`). No public A, CNAME,
MX or TXT records were found for the apex or `www` at the time of writing, so
there is no existing site to preserve. **Do not add these records if that
changes or if the domain is used for email elsewhere.**

Two sensible options:

- **Recommended: `mapy.adriansliacky.sk`** — one DNS record, no effect on the
  apex domain or email.
- **Root domain: `adriansliacky.sk`** — the site opens at the bare domain and
  GitHub redirects `www.adriansliacky.sk` to it. More DNS records.

---

## Option A — recommended subdomain `mapy.adriansliacky.sk`

### 1. Add one DNS record in Cloudflare

In Cloudflare → **adriansliacky.sk → DNS → Records**, add:

| Type | Name | Target | Proxy status | TTL |
| --- | --- | --- | --- | --- |
| CNAME | `mapy` | `adrian-sliacky-gymzv.github.io` | **DNS only** (grey cloud) | Auto |

Important: use **DNS only**, not the orange-cloud proxy, while GitHub verifies
the domain and issues the HTTPS certificate.

Verify from a terminal:

```powershell
Resolve-DnsName mapy.adriansliacky.sk -Type CNAME
```

It should return `adrian-sliacky-gymzv.github.io`.

### 2. Add the CNAME file to the site

Create `webapp/CNAME` containing exactly:

```text
mapy.adriansliacky.sk
```

Commit and push. The file must be at the root of the published site.

### 3. Set the custom domain in GitHub

Repository → **Settings → Pages → Custom domain**:

```text
mapy.adriansliacky.sk
```

Click **Save**, wait for the DNS check to pass, then enable **Enforce HTTPS**.
GitHub may take a few minutes and, rarely, up to 24 hours to issue the
certificate.

The final URL will be:

```text
https://mapy.adriansliacky.sk
```

---

## Option B — root domain `adriansliacky.sk`

### 1. Add DNS records in Cloudflare

For the apex (`@`), add four A records and four AAAA records:

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

Then add the `www` redirect target:

| Type | Name | Target | Proxy status | TTL |
| --- | --- | --- | --- | --- |
| CNAME | `www` | `adrian-sliacky-gymzv.github.io` | **DNS only** | Auto |

Remove any conflicting A/AAAA/CNAME records for `@` or `www`. Do not use the
orange-cloud proxy for these records while GitHub verifies the domain.

Cloudflare also supports a flattened CNAME at `@`, but the A/AAAA records above
match GitHub’s documented setup more directly.

### 2. Add the CNAME file

Create `webapp/CNAME` containing exactly:

```text
adriansliacky.sk
```

Commit and push.

### 3. Set the custom domain in GitHub

Repository → **Settings → Pages → Custom domain**:

```text
adriansliacky.sk
```

Save it, wait for the check, then enable **Enforce HTTPS**. GitHub will redirect
`www.adriansliacky.sk` to the apex domain when both records are present.

---

## What happens to the existing GitHub Pages URL?

The default URL remains available during preparation:

```text
https://adrian-sliacky-gymzv.github.io/editor-map-2-web/
```

Once a custom domain is configured, GitHub Pages may redirect the default URL
to the custom domain. That is expected.

## Cloudflare notes

- During setup, every GitHub Pages record must be **DNS only** (grey cloud).
- After GitHub has issued the certificate and **Enforce HTTPS** is on, the
  orange cloud can optionally be enabled with SSL/TLS mode **Full (strict)**.
  If you see redirect loops, switch back to DNS only.
- Do not add a Cloudflare “Always Use HTTPS” rule until the GitHub certificate
  is active.
- Keep any unrelated MX/TXT records for email; only replace conflicting records
  for `@` or `www`.

## If you want me to finish the GitHub side

After the DNS record(s) are added, tell me and I can:

1. create `webapp/CNAME`,
2. set the custom domain through the GitHub API,
3. wait for GitHub’s DNS/TLS check,
4. verify `https://mapy.adriansliacky.sk` (or the apex) in a browser.

I cannot add the DNS records because the Cloudflare account is not accessible
from this machine.
