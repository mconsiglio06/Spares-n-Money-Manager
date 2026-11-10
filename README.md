# Spares 'n Money Manager

Prototipo di un'app per gestire i propri risparmi e i soldi ricevuti dagli stipendi.

## Funzionalità

- **Aggiungi denaro**: importo, mese e anno di ricezione (obbligatori), descrizione facoltativa
  e **tipo di entrata**: generica, stipendio, tredicesima, quattordicesima, TFR, paghetta.
- **Sottrai denaro**: importo e descrizione (obbligatori), mese e anno facoltativi.
- **Indebiti**: denaro uscito dal saldo che deve rientrare (es. un prestito a un amico).
  Finché è aperto viene tolto dal saldo e conteggiato nel riquadro *Indebiti da rientrare*,
  insieme al *Totale con indebiti* (saldo + indebiti aperti). Con ✓ lo segni come rientrato
  e l'importo torna nel saldo.
- **Modifica**: tocca un movimento per cambiarne importo, descrizione, tipo, categoria o data.
- **Categorie**: all'inizio non ce n'è nessuna; si creano dal pulsante *Categorie*
  (dove si possono anche rinominare ed eliminare) o direttamente dal modulo di un movimento.
- **Grafici**: spese per mese e per categoria, con il totale speso e la media mensile,
  filtrabili per *ultimi 12 mesi*, singolo anno o *tutto*.
- **Totale disponibile**: saldo con entrate e spese separate.
- Layout a due colonne su PC e iPad in orizzontale, tema chiaro/scuro automatico, funziona offline.
- *Cancella tutti i dati* azzera movimenti e categorie.

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

- Filtri e ricerca nell'elenco dei movimenti
- Esportazione/importazione dei dati (backup) e sincronizzazione tra dispositivi
- Pacchetto nativo per App Store / Windows (es. con Capacitor o Tauri)
