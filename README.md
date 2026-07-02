# Triathlon Planner

MVP statico per raccogliere i dati di un atleta e generare un blocco di allenamento triathlon con:

- profilo anagrafico e prestativo;
- giorni disponibili e orari di lavoro;
- obiettivo gara e settimane di piano;
- vincoli di luce diurna per bici e corsa;
- suggerimenti di route template per i lunghi.


## Note

- Il calcolo del tramonto e' locale e non richiede API esterne.
- Le route sono template strutturali, non navigazione turn-by-turn.
- Una prossima iterazione puo' integrare mappe, routing reale e persistenza utenti.

## Mobile & Garmin

- La UI e' pronta per essere usata su telefono e la base PWA e' inclusa (`manifest.webmanifest` + `service-worker.js`).
- Per installarla davvero su iPhone o Android non basta aprire il file locale: serve servirla da `localhost` o da un dominio `https`.
- E' presente anche l'export `Garmin-ready` in JSON: e' la bozza tecnica per una futura sync automatica.
- Il push diretto stile RUNNA verso Garmin richiede un backend con OAuth 2.0 e accesso approvato al Garmin Connect Developer Program, in particolare Training API e Courses API.
- Per integrazioni ancora piu' profonde e controllo real-time del wearable, Garmin documenta anche i Garmin Health SDKs per partner enterprise.


## Pubblicazione Gratis Con GitHub Pages

Il progetto e' gia' configurato per GitHub Pages con workflow GitHub Actions in `.github/workflows/deploy-pages.yml`.

Passaggi minimi:

1. Crea un repository GitHub pubblico.
2. Carica dentro il contenuto di questa cartella.
3. Vai in `Settings > Pages` del repository.
4. In `Build and deployment`, scegli `GitHub Actions` come source.
5. Fai push su `main` o `master`.
6. Dopo il workflow, il sito sara' online su un URL `github.io`.

Quando il link e' online:

1. Aprilo da Safari su iPhone.
2. Tocca `Condividi`.
3. Tocca `Aggiungi alla schermata Home`.

Note:

- Il workflow pubblica solo i file utili all'app e non include gli screenshot di test.
- GitHub Pages e' gratis per repository pubblici.
- Il sito puo' impiegare qualche minuto a comparire dopo il primo push.


_Trigger GitHub Pages rebuild after enabling branch publish._
