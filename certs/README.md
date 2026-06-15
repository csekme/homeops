# Local dev TLS certificates

The dev stack serves everything through `https://homeops.localhost` (spec §5.7).
nginx (in `docker-compose.yml`) expects these files **here**, named exactly:

- `homeops.localhost.pem`      (certificate)
- `homeops.localhost-key.pem`  (private key — **never committed**, see `.gitignore`)

These are generated per-developer with [mkcert](https://github.com/FiloSottile/mkcert)
and are gitignored. Generate them once:

```bash
# 1) Install the local CA into your OS/browser trust store (once per machine)
mkcert -install

# 2) Issue the cert for the dev domain (run inside certs/)
cd certs && mkcert homeops.localhost
#   → produces homeops.localhost.pem + homeops.localhost-key.pem

# 3) Map the dev domain to loopback (most browsers resolve *.localhost
#    automatically, but add it for full compatibility):
#    /etc/hosts:  127.0.0.1 homeops.localhost
```

Changing the domain (e.g. `app.homeops.test`) means updating `server_name` in
`reverse-proxy/nginx.conf`, `/etc/hosts`, and the `mkcert` argument together.
