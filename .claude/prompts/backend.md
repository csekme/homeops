Backend (Flask) felépítése
```
app/
  __init__.py        # create_app() factory, extension-init
  api/               # Blueprint-ek = REST végpontok (vékony controller)
  services/          # üzleti logika (itt él a domain szabály)
  repositories/      # adatelérés (SQLAlchemy), izolálva a service-től
  domain/            # entitások, value object-ek, enumok
  security/          # auth, jwt, jelszó-hash, RBAC, titokkezelés
  integrations/      # connector adapterek (gdrive, onedrive, webdav)
  notifications/     # értesítés-generálás és csatornák
  tasks/             # háttérfeladatok (scheduler/worker)
  config.py
```
Elvek a kódminőséghez:
- **Vékony controller, vastag service:** a Blueprint csak validál + delegál. A logika a service-ben van → tesztelhető, újrahasználható.
- **Repository absztrakció:** a service nem ismeri az SQL-t. Ez a *Dependency Inversion* (a „D" a SOLID-ban) és megkönnyíti a tesztelést.
- **DRY:** közös dolgok (paginálás, hibakezelés, entitlement-check, audit) egy-egy központi helyen.

**Backend (Flask) — code-first:**
- A request/response **sémák** (Pydantic vagy Marshmallow) egyszerre három dolgot adnak: 
(1) input-validáció a vékony controllerben, 
(2) response-szerializáció, 
(3) az OpenAPI spec forrása. Egy séma, három haszon — DRY.

- Eszköz: **APIFlask** (Pydantic-alapú) — automatikus OpenAPI 3 + interaktív docs. (Alternatíva, ha Marshmallow-t preferálunk: flask-smorest.)

- Dev-időben (a proxyn keresztül, 5.7):
  - Nyers spec: `GET https://homeops.localhost/api/openapi.json`
  - Swagger UI: `https://homeops.localhost/api/docs`
  - ReDoc: `https://homeops.localhost/api/redoc`

- **Prod:** az interaktív docs **alapból kikapcsolva vagy auth mögött** (7.4 — security misconfiguration). A spec belső eszköz, nem publikus felület.