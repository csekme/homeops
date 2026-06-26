# Local dev TLS certificates

The dev stack serves everything through `https://homeops.localhost` (spec §5.7).
nginx (`docker-compose.yml` → `reverse-proxy/nginx.conf`) reads these files from **this
folder**, named exactly:

- `homeops.localhost.pem`      (certificate)
- `homeops.localhost-key.pem`  (private key — **never committed**, see `.gitignore`)

They're generated per-developer with [mkcert](https://github.com/FiloSottile/mkcert) and are
gitignored. mkcert creates a personal **root CA** and signs the cert with it; anything that
trusts that root CA trusts the cert.

---

## 1. First-time setup (per machine) — web only

```bash
# Install mkcert's root CA into your OS/browser trust store (once per machine)
mkcert -install

# Issue the cert for the dev domain (run inside certs/)
cd certs && mkcert homeops.localhost
#   → homeops.localhost.pem + homeops.localhost-key.pem

# Map the dev domain to loopback (most browsers resolve *.localhost already)
#   /etc/hosts:  127.0.0.1 homeops.localhost
```

Open `https://homeops.localhost` — the browser trusts it because step 1 installed the root
CA into the Mac's trust store. This is why the **web works on your machine out of the box**.

---

## 2. HTTPS on a physical phone (iOS) — the full procedure

A phone is a *different* device: it does **not** trust your Mac's mkcert root CA, and it
reaches the backend by **LAN IP** (e.g. `192.168.78.43`), not by `homeops.localhost`. So two
things must be true:

1. the cert must include your Mac's **current LAN IP** in its SAN list, and
2. the phone must **trust the mkcert root CA**.

### 2a. Find your Mac's current LAN IP

```bash
ipconfig getifaddr en0        # e.g. 192.168.78.43  (Wi-Fi; try en1 if empty)
```

### 2b. Regenerate the cert WITH that IP (preserving nginx's filenames)

`mkcert` would normally rename the output when given multiple names, so pin the filenames
with `-cert-file` / `-key-file`. Replace the IP with yours:

```bash
cd certs
mkcert -cert-file homeops.localhost.pem -key-file homeops.localhost-key.pem \
  homeops.localhost localhost 192.168.78.43 127.0.0.1

# verify the SAN now lists your IP:
openssl x509 -in homeops.localhost.pem -noout -ext subjectAltName
```

### 2c. Reload nginx so it serves the new cert

```bash
docker compose restart nginx
```

Verify from the Mac (simulates a trusting device — expect `HTTP 401`, i.e. reachable +
cert trusted):

```bash
curl --cacert "$(mkcert -CAROOT)/rootCA.pem" -s -o /dev/null -w "%{http_code}\n" \
  -X POST https://192.168.78.43/api/auth/login \
  -H 'Content-Type: application/json' -d '{"email":"x@x.com","password":"y"}'
```

### 2d. Where is the root CA? Send it to the phone

```bash
mkcert -CAROOT                 # prints the folder, e.g. /Users/csk/.local/share/mkcert
open "$(mkcert -CAROOT)"       # reveal it in Finder
```

The file to install on the phone is **`rootCA.pem`** in that folder. **AirDrop** it to the
iPhone (do *not* send `rootCA-key.pem` — that's the private key, keep it on the Mac).

### 2e. Install + trust it on the iPhone (one step is easy to miss)

1. **Install:** Settings → **General → VPN & Device Management** → tap the downloaded
   *mkcert…* profile → **Install** (enter passcode) → Install again.
2. **Enable full trust ⚠️ (the step everyone forgets):** Settings → **General → About →
   Certificate Trust Settings** → toggle **ON** the switch next to *mkcert development
   certificate*. iOS rejects the cert until you do this.

The root CA only needs to be installed **once** per phone — you don't redo this when the IP
changes, only steps 2a–2c.

### 2f. Point the app at the HTTPS URL and run

```bash
# apps/mobile/.env  (EXPO_PUBLIC_* vars are baked into the bundle at build time)
EXPO_PUBLIC_API_URL=https://192.168.78.43/api

# backend runs the normal way — nginx proxies to it via host.docker.internal:
cd backend && uv run flask --app app run -p 8080

# restart Expo with a clean cache so it picks up the .env change:
pnpm --filter @homeops/mobile start -c
```

Request path: `iPhone → https://192.168.78.43/api → nginx (TLS) → backend`.

### Checklist if login fails on the phone
- iPhone on the **same Wi-Fi** as the Mac.
- `.env` IP matches `ipconfig getifaddr en0` **and** the cert SAN (2a–2c).
- Step **2e.2** (Certificate Trust Settings toggle) is ON.
- Expo restarted with `-c` after editing `.env`.
- Quick reachability test from the Mac: the `curl --cacert …` in 2c returns `401`.

---

## 3. When your IP changes (DHCP)

Symptom: web still works, phone login suddenly fails. The Mac got a new LAN IP, so the
cert SAN and `.env` are stale. Fix = **2a → 2b → 2c**, then update the IP in
`apps/mobile/.env` and restart Expo with `-c`. **No need to reinstall the root CA** on the
phone — it already trusts mkcert; you're only reissuing a leaf cert it trusts.

> Tip: a static DHCP reservation for your Mac on your router avoids this entirely.

---

## 4. Plain-HTTP fallback (skip TLS in dev)

If you don't want to deal with certs on a device, point the app straight at the backend over
HTTP (Expo Go allows cleartext in dev; React Native isn't subject to CORS):

```bash
cd backend && uv run flask --app app run -p 8080 --host 0.0.0.0   # bind to the LAN
# apps/mobile/.env:
EXPO_PUBLIC_API_URL=http://192.168.78.43:8080/api                 # iOS sim: http://localhost:8080/api
```

This bypasses nginx entirely. The HTTPS path above is preferred because it mirrors prod.

---

## 5. Moving the server to Arch Linux (or any Linux)

**Yes, mkcert exists on Arch** — same tool, same commands. It's in the official repo:

```bash
sudo pacman -S mkcert nss     # `nss` lets mkcert also trust certs in Firefox/Chromium
mkcert -install               # installs the root CA into the system + browser trust stores
mkcert -CAROOT                # on Linux this is ~/.local/share/mkcert (or $XDG_DATA_HOME/mkcert)
```

Everything in sections 2–4 works identically on Linux (only the **iPhone** steps in 2e are
iOS-specific). On Arch the system trust store lives at
`/etc/ca-certificates/trust-source/anchors/` and is refreshed with `update-ca-trust` —
mkcert calls this for you via `p11-kit`/`trust`.

### Keep the SAME root CA across machines (so phones stay trusting)

If you already installed the mkcert root CA on your iPhone, **copy the CA to the new box**
instead of generating a fresh one — otherwise the phone would need to trust a new CA again:

```bash
# on the OLD machine: send both files from `mkcert -CAROOT`
#   rootCA.pem  AND  rootCA-key.pem      (the key never leaves trusted machines)
# on the ARCH box:
mkdir -p "$(mkcert -CAROOT)"
cp /path/to/rootCA.pem /path/to/rootCA-key.pem "$(mkcert -CAROOT)/"
mkcert -install
# then reissue the leaf cert there (section 2b) with the Arch box's LAN IP.
```

### For a real, always-on server, prefer a proper CA over mkcert

mkcert is built for **local dev**: its big downside is that **every client device must
install your private root CA** (the section-2e dance). For a permanent home/LAN server use
an ACME / Let's Encrypt certificate instead — then phones, laptops, etc. trust it
**automatically**, nothing to install:

- **Have a public domain** (e.g. `home.example.com` pointing at the server)? Use
  [Caddy](https://caddyserver.com/) as the reverse proxy — it gets & renews Let's Encrypt
  certs automatically (replaces nginx + this whole folder). `certbot` or `acme.sh` work too.
- **LAN-only / no public access** but you own a domain? Use a **DNS-01** challenge
  (`acme.sh --dns ...`) — it issues a publicly-trusted cert without exposing the server to
  the internet. Point the domain at the server's LAN IP (split-horizon DNS or `/etc/hosts`).
- **No domain at all, LAN IP only?** Then you're stuck with self-signed/mkcert and the
  per-device CA install — there's no way around it, because a public CA won't sign a bare IP.

If you switch to Caddy/Let's Encrypt, `reverse-proxy/nginx.conf` and the `certs/` mounts in
`docker-compose.yml` get replaced by the proxy's own config; `apps/mobile/.env` then points
at `https://<your-domain>/api` and the cert "just works" on every device.

## Changing the dev domain

Changing the domain (e.g. `app.homeops.test`) means updating `server_name` in
`reverse-proxy/nginx.conf`, `/etc/hosts`, and the `mkcert` argument together.

## Files in this folder
| File | What |
|------|------|
| `homeops.localhost.pem` / `-key.pem` | leaf cert + key nginx serves (gitignored) |
| `rootCA.pem` (location) | `$(mkcert -CAROOT)` — the CA to install on devices |
| `localhost.crt` / `.key` | legacy plain self-signed pair (not used by nginx) |
