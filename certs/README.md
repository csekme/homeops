Place your local HTTPS certificates here:
- localhost.crt
- localhost.key

Recommended (macOS): mkcert
1) brew install mkcert
2) mkcert -install
3) mkcert -key-file ./certs/localhost.key -cert-file ./certs/localhost.crt localhost 127.0.0.1 ::1

Recommended (Arch Linux):
# 1. Másold a helyére (sudo szükséges)
sudo cp certs/localhost.crt /etc/ca-certificates/trust-source/anchors/myrespo-localhost.crt

# 2. Frissítsd a rendszer tanúsítványtárát
sudo update-ca-trust