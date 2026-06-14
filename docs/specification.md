

npx shadcn@latest init --preset b27JkRsW --template vite

# HomeOps — Részletes termék- és architektúra-specifikáció

> Háztartás-menedzsment SaaS: befizetések, okmányok, közüzemi szolgáltatások, dokumentumok és teendők egy átlátható felületen, családi (több felhasználós) használatra.

---

## 1. Vízió és pozicionálás

**Egymondatos vízió:** A HomeOps egy olyan közös háztartási „operációs rendszer", amely egyetlen átlátható felületen tartja nyilván egy otthon összes ismétlődő kötelezettségét, lejáratát, kiadását és dokumentumát, és időben figyelmeztet, mielőtt bármi elcsúszna.

**Kit szolgál:** elsősorban családokat / háztartásokat, ahol több felelős (szülők, esetleg nagyobb gyerekek) közösen visel adminisztrációs terhet. Másodlagosan kisebb albérleti közösségeket, ingatlankezelőket.

**Milyen fájdalmat old meg:**
- Az adminisztráció szét van szórva (papír, levél, app, fej), ezért dolgok kicsúsznak (lejárt biztosítás, kihagyott csekk, elmaradt karbantartás).
- Nincs egyetlen pont, ahol látszik a havi költés és a közelgő teendők.
- A felelősség nincs delegálva: mindig „valaki más" intézte volna.

**Alapelv — „a felelősség a szolgáltatóké, nem a HomeOpsé":** a rendszer **nyilvántartó és szervező felület**. Nem ő a fizetési szolgáltató, nem ő a tárhely, nem ő a hitelesítő hatóság. A fájlokat a felhasználó saját felhőjében (Google Drive / OneDrive / WebDAV) tartja, a HomeOps csak **hivatkozást és metaadatot** tárol. Ez nemcsak filozófiai döntés, hanem **kockázat- és felelősség-csökkentő architekturális elv** (lásd 8. fejezet).

---

## 2. Alapfogalmak (domain szótár)

Egy közös szótár nélkül az egész terv félreérthető. Az alábbi fogalmakat végig egységesen használom.

- **Háztartás (Household / Tenant):** a fő izolációs egység. Minden adat egy háztartáshoz tartozik. Egyben ez a *tenant* a multi-tenant SaaS értelmében.
- **Felhasználó (User):** egy globális, e-mailhez kötött személyes fiók. Egy felhasználó **több háztartásnak is tagja lehet** (pl. valaki a saját és a szülei háztartásában is).
- **Tagság (Membership):** a User ↔ Household kapcsolat, ami **szerepkört és jogosultságot** hordoz. Fontos: a szerepkör nem a felhasználón, hanem a tagságon él.
- **Szerepkör (Role):** előre definiált jogosultság-csomag (pl. `OWNER`, `ADMIN`, `MEMBER`, `VIEWER`, `CHILD`). Bővíthető.
- **Jogosultság (Permission):** finomszemcsés művelet-engedély (pl. `expense.read`, `document.delete`, `connector.manage`). A szerepkör jogosultságok halmaza.
- **Kötelezettség / Teendő (Obligation):** bármilyen elvégzendő/figyelendő dolog: csekk befizetése, biztosítás megújítása, hőszivattyú karbantartás, fa tápoldatozása. Lehet **egyszeri** vagy **ismétlődő** (RRULE alapon).
- **Szolgáltatás / Előfizetés (Service):** rendszeres kiadás vagy szerződés (Netflix, internet, biztosítás, közüzem). Költséget és lejáratot/megújítást is hordozhat.
- **Kiadás (Expense):** egy konkrét pénzmozgás vagy tervezett kiadás, opcionálisan egy Service-hez vagy Obligationhöz kötve.
- **Dokumentum (Document):** egy külső tárhelyen lévő fájl **referenciája** (provider, fájlazonosító, név, típus, méret, checksum) + kategória/címke.
- **Mérőóra-állás (MeterReading)** víz/gáz/villany leolvasások időbélyeggel — később hasznos a fogyasztás-trendekhez.
- **Konnektor (Connector):** egy külső integráció konfigurációja (pl. egy összekötött Google Drive fiók) + a hozzá tartozó **titkosított** hozzáférési titkok.
- **Értesítés (Notification):** egy generált figyelmeztetés (közelgő lejárat, esedékes fizetés) + a kézbesítési csatorna (e-mail / push) és státusz.

---

## 3. Funkcionális követelmények

### 3.1 Háztartás és multi-tenant kezelés
- Regisztrált felhasználó **létrehozhat** egy háztartást → automatikusan `OWNER` lesz.
- Egy felhasználó **több háztartásban** is részt vehet; a felületen háztartás-váltó.
- A háztartás tulajdonosa **meghívhat** tagokat e-mailben (egyszer használatos, lejáró meghívó-token).
- Háztartás archiválható / törölhető (soft delete + későbbi végleges törlés GDPR-okból).

### 3.2 Felhasználók, szerepkörök, jogosultságok (RBAC)
- Alap szerepkörök:
  - **OWNER** – mindent tud, beleértve a számlázást és a háztartás törlését.
  - **ADMIN** – tartalom + tagok kezelése, de nem törli a háztartást, nem kezeli a számlázást.
  - **MEMBER** – teendők, kiadások, dokumentumok létrehozása/szerkesztése.
  - **VIEWER** – csak olvasás (pl. nagyszülő, könyvelő).
  - **CHILD** – korlátozott, „gyerek" nézet (pl. csak a rá kiosztott teendők, pénzügyek elrejtve). Ez kielégíti az „Apa, Anya, gyerekek különböző jogosultsággal" igényt.
- A jogosultságok **finomszemcsések** (permission-alapúak), a szerepkör csak előre összerakott csomag. Ez teszi lehetővé a későbbi testreszabást.
- Felelős hozzárendelés: minden Obligation **felelőshöz (assignee)** rendelhető — így látszik, kinek a dolga.

### 3.3 Teendők / kötelezettségek (ismétlődés, határidők)
- Egyszeri és **ismétlődő** teendők. Az ismétlődés **iCal RRULE** szabvány szerint (`FREQ=YEARLY`, `FREQ=MONTHLY;BYMONTHDAY=15`, stb.) — ez ipari szabvány, nem kell saját ismétlés-logikát kitalálni.
- Mezők: cím, leírás, kategória, esedékesség (due date), felelős, prioritás, becsült/tényleges költség, csatolt dokumentum(ok), előzetes figyelmeztetés ideje (pl. „14 nappal előtte").
- Státuszok: `UPCOMING` → `DUE` → `DONE` / `OVERDUE` / `SKIPPED`.
- Ismétlődő teendőnél a következő előfordulás a befejezéskor (vagy ütemezetten) generálódik.
- Példák, amiket a domain modellnek le kell fednie: műszaki vizsga, biztosítás-megújítás, hőszivattyú karbantartás, kerti tápoldatozás, csekk befizetés.

### 3.4 Pénzügyek, kiadások, havi áttekintés
- Kiadás rögzítése: összeg (lásd lent), pénznem, dátum, kategória, ismétlődő-e, kapcsolt szolgáltatás.
- **Pénzügyi pontosság:** az összegeket **egész számként, a pénznem legkisebb egységében** (pl. fillér/cent) tároljuk, külön ISO 4217 pénznem-kóddal. **Soha nem float** (kerekítési hibák elkerülése).
- Havi áttekintés: kategóriánkénti bontás, fix vs. változó kiadás, „mire megy el a pénz" (Netflix, internet, biztosítások…), trend hónapról hónapra.
- Költségvetés (budget) később: kategória-limitek és túllépés-figyelmeztetés.

### 3.5 Szolgáltatások / előfizetések nyilvántartása
- Szolgáltatás = visszatérő szerződés/előfizetés: szolgáltató neve, díj, számlázási ciklus, szerződés kezdete/lejárata, felmondási határidő, dokumentum(ok).
- A szolgáltatás automatikusan **generálhat ismétlődő kiadást és teendőt** (pl. „lejár a szerződés 30 nap múlva").
- „Felmondási ablak" figyelmeztetés: sok szerződés csak adott időablakban mondható fel — ez konkrét értéknövelő funkció.

### 3.6 Dokumentum- és fájlkezelés (külső integráció)
- Támogatott konnektorok (fázisokban): **Google Drive**, **OneDrive**, **WebDAV** (és WebDAV-on keresztül Nextcloud/ownCloud, FTP-szerű tárhelyek).
- A HomeOps **nem tárolja a fájl bájtjait** — csak referenciát + metaadatot (provider, external_file_id vagy path, név, MIME, méret, checksum, kategória, kapcsolt entitás).
- Műveletek: fájl összerendelése egy teendőhöz/szolgáltatáshoz, kategorizálás, keresés metaadat alapján, megnyitás (rövid életű, igény szerint kért hozzáférés / signed URL — soha nem tartós nyilvános link).
- Ha a felhasználó lecsatol egy konnektort, a fájl-referenciák „árvává" válnak (jelezzük), de a fájl a felhasználó felhőjében marad — összhangban a felelősség-elvvel. 

### 3.7 Dashboard
A „tökéletes dashboard" konkrét widgetekre bontva (mit lát a felhasználó belépéskor):
- **Mai/közeli teendők** (a következő 7–30 nap, felelőssel).
- **Lejárati idővonal:** okmányok, szerződések, vizsgák a következő hónapokban.
- **Havi kiadás-összesítő:** aktuális hónap költése + kategória-bontás + előző hónaphoz képest.
- **Esedékes befizetések** kiemelve (késedelem = piros).
- **Aktív riasztások** (lejáró, túllépett).
- A nézet **szerepkör-érzékeny**: a `CHILD`/`VIEWER` nem látja a pénzügyi blokkokat.

### 3.8 Értesítési rendszer (e-mail + push)
- Esemény-típusok: közelgő lejárat, esedékes fizetés, túllépett (overdue) teendő, meghívó, heti összefoglaló (digest).
- Csatornák: **e-mail** (tranzakciós e-mail szolgáltatón át), **push** (mobil: FCM/APNs; web: Web Push). 
- A felhasználó **csatornánként és típusonként** állíthatja a preferenciáit, és az előzetes idő-ablakot (pl. „7 és 1 nappal előtte").
- Megbízhatóság: a generálás **háttér-ütemezővel** történik (napi pásztázás a közelgő esedékességekre) + **outbox pattern** a kézbesítés idempotens, újrapróbálható kiküldéséhez (nincs dupla e-mail, nincs elveszett értesítés).

### 3.9 Előfizetési / csomag modell (későbbi fázis)
A kódot már most úgy érdemes felépíteni, hogy a korlátok bevezethetők legyenek anélkül, hogy szét kéne szedni a rendszert:
- **Plan** (csomag) entitás: limitek pl. `max_members`, `max_services`, `max_connectors`, `max_storage_refs`, feature-kapcsolók (pl. push engedélyezett-e).
- A háztartáshoz egy aktív **Subscription** tartozik (plan + státusz + lejárat).
- **Feature-gate** réteg: minden korlátos művelet egy központi `entitlement` ellenőrzésen megy át. Így a csomag-logika **egy helyen** él (DRY), nem szóródik szét.
- Fizetés-integráció (pl. Stripe) **csak ekkor** kerül be — addig is a `Subscription` modell létezhet „free" planre állítva.

---

## 4. Nem-funkcionális követelmények

| Terület | Cél |
|---|---|
| **Biztonság** | OWASP ASVS L2 szintet célzó kontrollok; OWASP Top 10 lefedés (lásd 7.4). |
| **Adatvédelem** | GDPR: adatminimalizálás, export és törlés (right to erasure), célhoz kötött tárolás, naplózott hozzáférés. |
| **Tenant-izoláció** | Egy háztartás adata semmilyen úton nem szivároghat másikba (DB szintű RLS, lásd 5.2 és 7.2). |
| **Megbízhatóság** | Értesítés sosem vész el (outbox + retry); idempotens háttérfeladatok. |
| **Teljesítmény** | Dashboard < ~300 ms tipikus terhelésnél; megfelelő indexelés a háztartás-szűrésre és esedékesség-rendezésre. |
| **Skálázhatóság** | Állapotmentes (stateless) API → vízszintesen skálázható; háttér-worker külön skálázható. |
| **Megfigyelhetőség** | Strukturált log (request-id, household-id, **soha nem titok/PII**), metrikák, health-check végpontok. |
| **Kódminőség** | Clean Code, SOLID, DRY; réteges architektúra; magas tesztlefedettség a domain/service rétegen (lásd 9.). |

---

## 5. Architektúra

### 5.1 Magas szintű kép

```mermaid
flowchart TB
    subgraph Kliensek
      W[Web app: React + shadcn/ui]
      M[Mobil: React Native]
    end

    subgraph Backend["Backend (Flask, állapotmentes)"]
      API[REST API + Auth réteg]
      SVC[Service / domain réteg]
      REPO[Repository réteg]
    end

    subgraph Hatter["Háttér"]
      SCHED[Ütemező: közelgő esedékességek pásztázása]
      WORKER[Worker: értesítés-kiküldés, integráció-hívások]
    end

    DB[(PostgreSQL + Row Level Security)]
    KMS[[Titokkezelő / KMS]]
    MAIL[E-mail szolgáltató]
    PUSH[FCM / APNs / Web Push]
    EXT[Külső tárhelyek: Google Drive / OneDrive / WebDAV]

    W -->|httpOnly cookie + access token| API
    M -->|secure store token| API
    API --> SVC --> REPO --> DB
    SCHED --> DB
    SCHED --> WORKER
    WORKER --> MAIL
    WORKER --> PUSH
    WORKER -->|titok feloldása futásidőben| KMS
    WORKER --> EXT
    SVC -->|titok feloldása futásidőben| KMS
```

### 5.2 Multi-tenancy stratégia — **ajánlás: közös séma + `household_id` + PostgreSQL RLS**

Három klasszikus megközelítés:

1. **Külön adatbázis tenantonként** — legerősebb izoláció, de SaaS-nál sok ezer háztartásnál üzemeltetési rémálom. *Elvetve.*
2. **Külön séma tenantonként** — közepes izoláció, bonyolult migráció sok tenantnál. *Elvetve MVP-re.*
3. **Közös séma, `household_id` diszkriminátor + Row Level Security** — egyetlen séma, minden táblán `household_id`, és **PostgreSQL RLS policy** garantálja, hogy a session csak a saját háztartása sorait lássa. **Ezt ajánlom.**

Az RLS azért kulcsfontosságú, mert **az adatbázis maga** kényszeríti ki az izolációt, nem csak az alkalmazás-kód. Ha valahol kimaradna egy `WHERE household_id = ?` szűrés (emberi hiba), az RLS akkor is megvéd. A backend minden tranzakció elején beállítja a kontextust (pl. `SET app.current_household = '<uuid>'`), és a policy erre szűr.

### 5.3 Backend (Flask) felépítése
Réteges, app-factory mintával (összhangban a Clean/SOLID elvekkel):

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

Elvek a kódminőséghez (amit kértél):
- **Vékony controller, vastag service:** a Blueprint csak validál + delegál. A logika a service-ben van → tesztelhető, újrahasználható.
- **Repository absztrakció:** a service nem ismeri az SQL-t. Ez a *Dependency Inversion* (a „D" a SOLID-ban) és megkönnyíti a tesztelést.
- **DRY:** közös dolgok (paginálás, hibakezelés, entitlement-check, audit) egy-egy központi helyen.
- **Value object-ek:** pl. `Money` (összeg + pénznem) saját típusként, hogy ne szóródjon szét a pénz-logika.

> Megjegyzés a stackről: a réteges felépítés (controller → service → repository) és a SOLID/DRY elvek **keretrendszer-függetlenek** — pontosan ugyanaz a gondolkodás, mint egy Spring Boot világban (RestController → Service → Repository). Tehát a Flask választás nem korlátoz az enterprise-szintű minőségben; csak az eszközök mások.

### 5.4 Frontend (React + shadcn/ui)
- TypeScript, komponens-alapú, **szerver-állapot** kezelése pl. TanStack Query-vel (cache + újratöltés), nem nyers fetch szétszórva.
- shadcn/ui a dizájn-rendszer alapja (konzisztens, akadálymentes komponensek).
- i18n már az elején (magyar/angol) — később a SaaS-nál hasznos.
- Az **access token csak memóriában** él (nem localStorage — XSS-kockázat), a frissítés httpOnly cookie-val (lásd 7.1).

### 5.5 Mobil (React Native)
- A token a platform **secure store**-jában (iOS Keychain / Android Keystore), nem sima async storage-ban.
- Push: FCM (Android) + APNs (iOS), device-token regisztráció a backend felé.
- A web és mobil **ugyanazt a REST API-t** használja → egyetlen szerződés (contract), kevesebb duplikáció.

### 5.6 Háttérfeladatok
- **Ütemező** (pl. APScheduler egyszerűbb kezdéshez, vagy Celery beat skálázáshoz): naponta pásztázza a közelgő esedékességeket és feltölti az értesítés-outboxot.
- **Worker:** az outboxból idempotensen küldi az e-mailt/pusht, és ez hívja a külső tárhely API-kat is. Külön skálázható az API-tól.

---

## 6. Adatmodell vázlat

Fő entitások és kapcsolataik (egyszerűsített ERD):

```mermaid
erDiagram
    USER ||--o{ MEMBERSHIP : "tag"
    HOUSEHOLD ||--o{ MEMBERSHIP : "tagok"
    HOUSEHOLD ||--o{ OBLIGATION : ""
    HOUSEHOLD ||--o{ SERVICE : ""
    HOUSEHOLD ||--o{ EXPENSE : ""
    HOUSEHOLD ||--o{ DOCUMENT : ""
    HOUSEHOLD ||--o{ CONNECTOR : ""
    HOUSEHOLD ||--|| SUBSCRIPTION : ""
    MEMBERSHIP }o--|| ROLE : ""
    SERVICE ||--o{ EXPENSE : "generál"
    SERVICE ||--o{ OBLIGATION : "generál"
    OBLIGATION }o--o| MEMBERSHIP : "felelős"
    OBLIGATION ||--o{ DOCUMENT : "csatolt"
    CONNECTOR ||--o{ DOCUMENT : "tárol referenciát"
    OBLIGATION ||--o{ NOTIFICATION : "kivált"

    USER {
      uuid id PK
      string email UK
      string password_hash
      datetime created_at
    }
    HOUSEHOLD {
      uuid id PK
      string name
      datetime created_at
    }
    MEMBERSHIP {
      uuid id PK
      uuid user_id FK
      uuid household_id FK
      uuid role_id FK
    }
    OBLIGATION {
      uuid id PK
      uuid household_id FK
      string title
      string category
      date due_date
      string rrule
      string status
      uuid assignee_membership_id FK
      bigint estimated_amount_minor
      string currency
    }
    SERVICE {
      uuid id PK
      uuid household_id FK
      string provider_name
      bigint fee_amount_minor
      string currency
      string billing_cycle
      date contract_end
      date cancellation_deadline
    }
    EXPENSE {
      uuid id PK
      uuid household_id FK
      uuid service_id FK
      bigint amount_minor
      string currency
      date occurred_on
      string category
    }
    DOCUMENT {
      uuid id PK
      uuid household_id FK
      uuid connector_id FK
      string external_ref
      string name
      string mime_type
      bigint size_bytes
      string checksum
    }
    CONNECTOR {
      uuid id PK
      uuid household_id FK
      string provider
      bytea encrypted_secret
      string encrypted_dek
      string status
    }
    NOTIFICATION {
      uuid id PK
      uuid household_id FK
      string type
      string channel
      string status
      datetime scheduled_for
    }
    SUBSCRIPTION {
      uuid id PK
      uuid household_id FK
      string plan
      string status
      date valid_until
    }
    ROLE {
      uuid id PK
      string name
      jsonb permissions
    }
```

Néhány indexelési/teljesítmény-megjegyzés:
- Minden „tartalom" táblán `household_id` index (az RLS-szűrés és a tenant-lekérdezések miatt).
- `OBLIGATION (household_id, due_date, status)` összetett index — a dashboard és az ütemező ezt fésüli át.
- `EXPENSE (household_id, occurred_on)` a havi összesítőkhöz.

---

## 7. Biztonsági terv (kritikus rész)

### 7.1 Authentikáció
- **Jelszó:** Argon2id (vagy bcrypt) hasheléssel, soha nem visszafejthetően.
- **Token-páros:**
  - **Access token** (JWT, rövid élettartam, ~10–15 perc) — a kérésekhez. A weben **memóriában**, mobilon **secure store**-ban.
  - **Refresh token** (hosszú élettartam) — **httpOnly, Secure, SameSite cookie**-ban a weben; szerver oldalon **hash-elve tárolva**, hogy visszavonható és forgatható (rotation) legyen.
- **Refresh-rotáció + reuse-detekció:** minden frissítéskor új refresh token; ha egy már felhasznált tokent újra próbálnak beváltani, az egész láncot érvénytelenítjük (lopott token elleni védelem).
- **CSRF:** mivel a refresh cookie-ban van, a refresh-végpontot CSRF ellen kell védeni (SameSite=strict/lax + double-submit token vagy custom header ellenőrzés).
- Opcionális 2FA (TOTP) későbbi fázisban.

### 7.2 Authorizáció
- **RBAC** finomszemcsés jogosultságokkal (3.2). Minden service-művelet egy permission-ellenőrzésen megy át.
- **Tenant-izoláció két rétegben:** (1) az alkalmazás minden lekérdezése `household_id`-re szűr, és (2) a PostgreSQL **RLS** a végső védőháló. A kettő együtt = védelem az emberi hiba ellen is.

### 7.3 Integrációs titkok kezelése — **a korona ékköve**
Ez az a pont, amit külön kiemeltél („nem kompromittálódhat"), és ez a rendszer legkényesebb része. Ajánlott megközelítés: **envelope encryption (boríték-titkosítás).**

```mermaid
flowchart LR
    A[OAuth refresh token a szolgáltatótól] --> B[Titkosítás egyedi DEK-kel]
    B --> C[Titkosított titok a DB-ben]
    D[DEK: adat-titkosító kulcs] --> E[DEK titkosítása KEK-kel]
    E --> F[Titkosított DEK a DB-ben]
    G[KEK: kulcs-titkosító kulcs a KMS/Vault-ban, sosem hagyja el] --> E
```

Lényeg:
- Minden titkot (OAuth refresh token, WebDAV jelszó stb.) egy **egyedi adat-titkosító kulccsal (DEK)** titkosítunk.
- A DEK-et egy **kulcs-titkosító kulcs (KEK)** titkosítja, ami **KMS-ben / HashiCorp Vault-ban** él és **sosem hagyja el** azt. A DB-be csak a *titkosított* DEK és a *titkosított* titok kerül.
- A feloldás **futásidőben, épp csak amíg kell** történik a workerben, és **a feloldott titok sosem kerül logba, hibaüzenetbe, válaszba**.
- Egyszerűbb átmeneti megoldás MVP-re: PostgreSQL **pgcrypto** + környezeti változóból olvasott kulcs — de éles SaaS-nál a KMS/Vault az ajánlott cél, mert így a DB-dump önmagában nem ér semmit.
- **Kulcs-rotáció:** a KEK cserélhető a DEK-ek újra-titkosításával, a tényleges adat újra-titkosítása nélkül.
- **Legkevesebb jogosultság elve:** csak a worker fér a feloldáshoz, az API réteg nem.

### 7.4 OWASP Top 10 lefedés (röviden, hogyan kezeljük)
| Kockázat | Védelem |
|---|---|
| Broken Access Control | RBAC + RLS kettős réteg (7.2). |
| Cryptographic Failures | Argon2 jelszó, envelope encryption titkokra, TLS mindenhol. |
| Injection | Kizárólag paraméterezett lekérdezés (ORM), input-validáció. |
| Insecure Design | Threat modell, felelősség-elv (külső tárhely), least privilege. |
| Security Misconfiguration | Biztonságos default-ok, security header-ek, titkok nem a kódban. |
| Vulnerable Components | Függőség-szkennelés (pl. pip-audit, npm audit) a CI-ban. |
| Auth Failures | Token-rotáció, reuse-detekció, rate limit a login-ra. |
| Integrity Failures | Aláírt artefaktumok, lockfile-ok, CI ellenőrzés. |
| Logging/Monitoring | Strukturált log, audit trail, riasztások — PII/titok soha. |
| SSRF | A connector-hívások allowlistolt hosztokra, validált URL-ek. |

### 7.5 Audit log
Minden érzékeny művelet (jogosultság-változás, connector-kezelés, dokumentum-törlés, számlázás) **megváltoztathatatlan audit bejegyzést** kap: ki, mit, mikor, melyik háztartásban. Ez GDPR és incidens-vizsgálat szempontból is kell.

---

## 8. Külső tárhely integráció részletei

### OAuth bekötés folyamata (Google Drive / OneDrive)

```mermaid
sequenceDiagram
    participant U as Felhasználó
    participant FE as Frontend
    participant BE as Backend
    participant P as Tárhely-szolgáltató

    U->>FE: "Google Drive összekötése"
    FE->>BE: connector init kérés
    BE->>U: átirányítás a szolgáltató consent oldalára
    U->>P: hozzájárulás (scope: csak ami kell)
    P->>BE: authorization code (callback)
    BE->>P: code beváltása access + refresh tokenre
    BE->>BE: refresh token titkosítása (envelope), tárolás
    BE->>FE: connector kész
    Note over BE,P: Később a worker a titkosított tokennel<br/>kér rövid életű access tokent, ha fájl kell
```

Elvek:
- **Minimális scope:** csak annyi hozzáférés, amennyi kell (pl. csak app-mappa, nem a teljes Drive, ahol a szolgáltató ezt támogatja).
- **Csak referencia tárolása:** a `DOCUMENT` rekord a külső fájlra mutat; a bájtokat sosem másoljuk be tartósan.
- **Megnyitás:** igény szerint, rövid életű hozzáféréssel (signed URL / friss access token), nem tartós nyilvános linkkel.
- **WebDAV/FTP:** itt nincs OAuth, hanem felhasználónév+jelszó → ezt ugyanazzal a titkosítási mechanizmussal kezeljük (7.3).
- **Lecsatolás:** a felhasználó bármikor lecsatolhatja a connectort; ekkor a titkokat töröljük, a referenciák megmaradnak „árva" jelzéssel.

---

## 9. Fejlesztési fázisok / roadmap

Az MVP-t úgy érdemes szabni, hogy a **mag-érték** (átláthatóság + emlékeztetés) gyorsan kézzelfogható legyen, a SaaS- és fizetős funkciók pedig ráépülhessenek.

**0. fázis — Alapozás**
- App-factory, réteges váz, PostgreSQL + migráció (pl. Alembic), CI (lint + teszt + függőség-szken).
- Auth (regisztráció, login, token-páros, RLS bekapcsolása).
- Regisztráció során a user kap egy aktiváló email-t email-ben amivel validáljuk a felhasználó email párost. Csak aktiválás után tud majd belépni.

**1. fázis — MVP mag**
- Háztartás létrehozás + tagmeghívás + RBAC.
- Teendők (egyszeri + ismétlődő RRULE), felelős hozzárendelés.
- Kiadás-rögzítés + havi áttekintő.
- Egyszerű dashboard.
- E-mail értesítés közelgő esedékességre (ütemező + outbox).

**2. fázis — Dokumentumok és szolgáltatások**
- Szolgáltatás/előfizetés modul (lejárat, felmondási ablak, generált teendők).
- Első konnektor (pl. Google Drive) + envelope encryption élesben.
- Dokumentum-csatolás teendőkhöz/szolgáltatásokhoz.

**3. fázis — Mobil + push**
- React Native app, secure store, FCM/APNs push.
- Értesítés-preferenciák csatornánként.

**4. fázis — SaaS érettség**
- Subscription/Plan modell + entitlement-gate aktiválása.
- További konnektorok (OneDrive, WebDAV).
- Fizetés-integráció (pl. Stripe), számlázás.
- GDPR export/törlés önkiszolgáló.

**Tesztelési stratégia (végig, minden fázisban):**
- **Unit:** domain + service réteg (itt cél a magas lefedettség, mert itt az üzleti szabály).
- **Integrációs:** DB-vel (pl. Testcontainers / éles-szerű Postgres), hogy az RLS és a repository tényleg jól viselkedjen.
- **API/contract:** a végpontok szerződése (a web és mobil közös fogyasztói).
- **E2E:** a kritikus folyamatokra (regisztráció→háztartás→teendő→értesítés, connector-bekötés).
- **Biztonsági:** authz-tesztek (egy háztartás tagja ne lásson más háztartást), reuse-detekció, és statikus elemzés a CI-ban.

---

## 10. Nyitott kérdések / döntési pontok

Ezeket érdemes eldönteni, mielőtt kódolásba kezdesz — mindegyik befolyásolja a modellt:

1. **Pénznem:** egy háztartás egy pénznemmel dolgozik, vagy több (pl. EUR + HUF) is keveredhet? Ez a `Money` value object és az összesítők dizájnját érinti.
2. **„Gyerek" szerepkör mélysége:** csak korlátozott nézet, vagy saját, gamifikált teendő-lista is (pl. házimunka)? Az utóbbi külön funkció-kör.
3. **Naptár-integráció:** kell-e kétirányú Google/Outlook Calendar szinkron a teendőkhöz, vagy elég a saját idővonal? (A korábbi HomeOps-elképzelésben volt naptár-igény.)
4. **Mérőóra-modul:** belekerül az MVP-be vagy később? A fogyasztás-trend hasznos, de önálló alrendszer.
5. **Titokkezelés szintje MVP-re:** induláskor pgcrypto + env-kulcs elég, vagy már az elején KMS/Vault? (Költség vs. érettség kérdése.)
6. **Ütemező választás:** APScheduler (egyszerű, egy process) most, vagy rögtön Celery + üzenetsor (skálázható, de több infrastruktúra)?
7. **Csomag-limitek pontos paraméterei:** mik lesznek a tényleges határok (felhasználószám, szolgáltatásszám) és melyik feature melyik csomagban?

---

*Ez egy élő specifikáció — érdemes verziózni (pl. a repo `docs/` mappájában), és a döntési pontok lezárásakor frissíteni.*
