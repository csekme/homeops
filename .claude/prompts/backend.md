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