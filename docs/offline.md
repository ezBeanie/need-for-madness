# Offline und Updates

Das installierte Spiel (PWA) startet ohne Netz mit dem zuletzt vollständig installierten
Stand und spielt mit Netz bei jedem Start den neuesten. Zuständig sind `public/sw.js` (der
Service Worker) und `tools/offline/list.js` (die Dateiliste aus dem Build).

## Die Dateiliste

`npm run build` schreibt `dist/offline.json`: jede Datei des Builds mit einem Hash ihres
Inhalts (16 Hex-Stellen SHA-256), die Version als Hash über alle. Unter `core` steht alles,
was vor dem ersten Offline-Start da sein muss (ca. 19 MB, mit der Menümusik), unter `later`
die Streckenmusik (ca. 155 MB), die erst beim Abspielen gespeichert wird. `sw.js` und die
Liste selbst stehen nicht darin.

## Ein Start

1. Der Service Worker fragt `offline.json` am Server an (ohne Cache) und wartet höchstens
   4 s (`WAIT_MS`).
2. Kommt die Liste rechtzeitig, startet ihre Version: die Seite und jede Datei, nach der sie
   fragt, so wie die Liste sie nennt. Was schon gespeichert ist, kommt aus dem Speicher, der
   Rest vom Server.
3. Kommt sie nicht (offline, Server zu langsam), startet die installierte Version.
4. Daneben wird die neue Version installiert: alle Dateien unter `core`, jede vor dem
   Speichern gegen ihren Hash geprüft. Erst wenn alle da sind, gilt sie als installiert; dann
   wird weggeräumt, was weder sie noch eine offene Seite braucht. Bricht das ab, bleibt die
   vorige Version ganz, und der nächste Start macht weiter.

Jede Seite spielt von Anfang bis Ende eine Version (`client/<id>` im Cache `nfm-meta`; ein
Browser ohne `resultingClientId` nimmt die zuletzt gestartete). Neue Seite mit alten Daten
oder umgekehrt gibt es so nicht. Eine Datei, die nicht zu ihrem Hash passt (Server mitten im
Deploy), wird nicht gespeichert; passt die Seite selbst nicht, startet die installierte
Version.

Die Seite bittet um dauerhaften Speicher (`navigator.storage.persist()`), damit der Browser
die Dateien nicht nach einer Weile ohne Nutzung wegräumt.

## Optionen: Offline

Der Bereich „Offline“ in den Optionen (`src/ui/offline.js`, nur sichtbar mit Service Worker)
zeigt, ob das Spiel offline startbereit ist oder wie weit ein Update ist. Der Schalter
„Stages' music too“ lässt den Service Worker die ganze Streckenmusik beider Looks speichern
(Größe aus `sizes` in der Liste), mit Fortschritt; aus heißt: alle gespeicherte Musik weg.
Bricht der Download ab (kein Netz), steht dort, wie viel da ist; der nächste Start oder das
nächste Öffnen der Optionen macht weiter, ebenso nach einem Update mit neuer Musik.
Seite und Service Worker reden über `postMessage({ offline: "status" | "keepMusic" |
"dropMusic" })`; der Service Worker meldet jeden Fortschritt an alle Seiten (höchstens alle
250 ms).

## Zurück aus dem Hintergrund

Eine App aus dem Hintergrund startet nicht neu. Kommt sie im Hauptmenü zurück (nicht in einem
Raum, nicht mit offenen Optionen), fragt sie `offline.json` ab und lädt neu, wenn es eine
neuere Version gibt (`startNewest`).

## Grenzen

- Antwortet der Server langsamer als 4 s, startet der alte Stand; das Update kommt beim
  nächsten Start.
- Streckenmusik, die noch nie lief, fehlt offline, wenn der Schalter aus ist (das Rennen läuft
  ohne).
- In einer nativen App (Capacitor) gibt es keinen Service Worker: das Grundpaket steckt dort
  in der App, der Musik-Download müsste dort neu gebaut werden.

## Tests

`test/visual/offline.spec.js` baut das Spiel und liefert es über einen eigenen Server aus,
der einen Deploy, kaputte Dateien, einen langsamen Server und kein Netz nachstellt;
`test/offlineList.test.js` prüft die Liste, `test/offline.test.js` die Rückkehr aus dem
Hintergrund.
