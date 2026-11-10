# Spares 'n Money Manager

Prototipo di un'app per gestire i propri risparmi e i soldi ricevuti dagli stipendi.

## Funzionalità

- **Aggiungi denaro**: importo, mese e anno di ricezione (obbligatori), descrizione facoltativa.
- **Sottrai denaro**: importo e descrizione (obbligatori), mese e anno facoltativi.
- **Totale disponibile**: saldo calcolato su entrate e spese, con i totali separati.
- Elenco dei movimenti ordinati per periodo, con la possibilità di eliminarli.
- Tema chiaro/scuro automatico, funziona anche offline.

I dati restano **solo sul dispositivo** (`localStorage` del browser): non c'è nessun server
e nessun account. Se cancelli i dati del browser o dell'app, i movimenti vengono persi.

## Piattaforme: iOS e PC

L'app è una **Progressive Web App** (HTML + CSS + JavaScript, senza dipendenze né build),
quindi un solo codice gira su iPhone/iPad e su PC (Windows, macOS, Linux).

1. Pubblica la cartella su un hosting statico HTTPS (es. GitHub Pages: *Settings → Pages →
   Deploy from branch*).
2. **iPhone/iPad**: apri il link in Safari → *Condividi* → *Aggiungi alla schermata Home*.
   L'app si apre a schermo intero come un'app nativa.
3. **PC**: apri il link in Chrome o Edge → icona *Installa* nella barra degli indirizzi
   (oppure usala direttamente dal browser).

## Avvio in locale

```bash
python3 -m http.server 8000
# poi apri http://localhost:8000
```

Il service worker (offline) è attivo solo con `http://localhost` o HTTPS; si può anche
aprire `index.html` direttamente, ma senza la modalità offline.

## Struttura

| File | Contenuto |
|------|-----------|
| `index.html` | Interfaccia |
| `styles.css` | Stile (mobile-first, tema chiaro/scuro) |
| `app.js` | Logica: movimenti, validazione, calcolo del saldo, salvataggio |
| `manifest.webmanifest`, `sw.js`, `icons/` | Installazione come app e uso offline |

## Possibili prossimi passi

- Modifica di un movimento esistente
- Filtri per mese/anno e riepilogo mensile
- Categorie di spesa e grafici
- Esportazione/importazione dei dati (backup) e sincronizzazione tra dispositivi
- Pacchetto nativo per App Store / Windows (es. con Capacitor o Tauri)
