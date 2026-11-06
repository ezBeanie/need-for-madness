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

## Grenzen

- Ein Update kommt beim Neustart der App an. Aus dem Hintergrund zurückgeholt lädt sie nicht
  neu.
- Antwortet der Server langsamer als 4 s, startet der alte Stand; das Update kommt beim
  nächsten Start.
- Streckenmusik, die noch nie lief, fehlt offline (das Rennen läuft ohne).

## Tests

`test/visual/offline.spec.js` baut das Spiel und liefert es über einen eigenen Server aus,
der einen Deploy, kaputte Dateien, einen langsamen Server und kein Netz nachstellt;
`test/offlineList.test.js` prüft die Liste.
