# Multiplayer: Analyse und Plan

Stand: 2026-10-29, Basis c0bcca5.

## Wie tief steckt "Auto 0 ist der Spieler" im Code?

Gute Nachricht: Der Spieler ist fast überall schon `game.player` (src/core/state.js), weil der
Switch-Modus und die Replays das Auto wechseln. Hart verdrahtete `0` gibt es nur noch an
wenigen Stellen. Das Problem ist ein anderes: Es gibt genau **einen** Spieler. `game.player`
mischt zwei Bedeutungen, die im Multiplayer auseinanderfallen:

- **Mensch am Steuer** (Spielregeln: wer nicht von der KI gefahren wird, wer anders behandelt wird)
- **Auto dieses Bildschirms** (Kamera, HUD, Motorgeräusch, Highlights, Meldungen)

### Fundstellen nach Bereich

| Bereich | Stellen | Art | Aufwand |
|---|---|---|---|
| Eingabe `input/controls.js`, `input/gamepad.js` | 2 | schreibt Tasten in `racers[game.player].u` | klein |
| KI überspringt den Spieler `race/ai.js:247` | 1 | `if (c != game.player)` | klein |
| Physik `race/physics.js` | 17 | gemischt, siehe unten | mittel |
| KI-Verhalten `race/ai.js` | ~69 | KI richtet sich nach *dem* Spieler | groß, aber mechanisch |
| HUD `ui/hud.js` | 42 | Anzeige fürs eigene Auto | keiner (bleibt lokal) |
| Kamera, Motorgeräusch, `drawFrame`, Countdown | ~10 | Anzeige fürs eigene Auto | keiner bzw. klein |
| Standings, Recording, Highlights | ~10 | Kameraeffekte ums eigene Auto | keiner (lokal) |
| Meta: Meisterschaft, Freischalten, `raceEnd`, Autowahl `carTypes[0]` | ~10 | Einzelspieler-Fortschritt | im MP abschalten |

### Physik: was ist Regel, was ist Anzeige?

Spielregeln, die nur fürs Spielerauto gelten (müssen für **jeden Menschen** gelten):

- `pathPointAhead`: Spieler schaut 2 Pfadpunkte voraus, KI 1 (physics.js:358)
- Checkpoint verpasst: nur der Spieler bekommt `MISSED.following`/Warnung (physics.js:402, 413)
- Tutorial-Erleichterung auf Stage 1 und 2 (physics.js:677, 729), im MP abschalten
- Stunt-Tasten nur beim Spieler (`watchPlayerStuntKeys`, physics.js:2461)
- `lastcolido`/`colidim` bei Kollisionen mit dem Spieler (physics.js:3093, 3096, 3146)
- Autokorrektur dreht `racers[0]` um, nicht `game.player` (physics.js:161), wohl ein Altfehler
  im Switch-Modus

Reine Anzeige (bleibt "Auto dieses Bildschirms"): Sounds (486, 503, 1226, 3361),
`raceEvents` (342, 528), Highlights (642, 774).

### KI: der eigentliche Brocken

Die KI ist um *einen* Menschen gebaut: Gummiband nach `rank(game.player)` (ai.js:1860, 1895),
Angriffe und "bully" nur gegen den Spieler (ai.js:2672 bis 2835), stage-spezifische Skripte nach
dem Fortschritt des Spielers (`clearedPathPoint == 152` usw., ai.js:1484 bis 1764), Boss-Logik
auf Stage 7. Lösung ohne Umbau: eine Funktion `rivalOf(c)`, die für ein KI-Auto den Menschen
liefert, auf den es reagiert (z. B. den führenden Menschen). Mit einem Menschen liefert sie
`game.player`, damit bleiben die Golden Masters bitgleich.

Für den Prototyp reicht: **nur Menschen, keine KI-Autos**. Dann ist die KI egal.

## Plan

Grundsatz: Einzelspieler bleibt bitgleich, alle Golden Masters grün.

### Schritt 1: Zwei Begriffe trennen (ohne Netz, testbar)

- `game.humans`: Menge der menschlich gesteuerten Autos, Einzelspieler `[game.player]`.
- `isHuman(c)` in Eingabe-Gating (ai.js:247) und den Regel-Stellen der Physik.
- `game.player` bleibt "Auto dieses Bildschirms" für HUD, Kamera, Sound.
- `racers[0]` in physics.js:161, standings.js:118 bis 126, countdown.js:114 auf `game.player`.
- Test: Golden Masters unverändert; neuer Test mit zwei Menschen per Skript-Eingaben.

### Schritt 2: Host-Simulation mit entfernten Eingaben (lokal, zwei Tabs)

- Host simuliert, Gäste senden pro Tick ihre `u`-Tasten (7 Bits).
- Host sendet pro Tick einen Schnappschuss: Tape-Zeile (raceTape/recording) plus die HUD-Werte
  pro Auto (damage, power, pos, nlaps, missedCheckpoint, wasted, ...), die das Tape noch nicht hat.
- Gast simuliert nicht, sondern zeigt Schnappschüsse wie der Replay-Viewer, mit Interpolation.
- Transport zuerst `BroadcastChannel` zwischen zwei Tabs: kein Server nötig, Ablauf testbar.
- Aus Schritt 1 bekannt: Den Zähler von "Check Point Missed!" (`missedCheckpoint`) zählt das
  HUD des Spielers hoch (hud.js `drawTrackWarnings`), abhängig von Kamera und Pfeil. Für einen
  entfernten Menschen bleibt er beim Host stehen; ihn zählt künftig der Bildschirm des Gastes.

Stand nach Schritt 2: `src/net/{link,host,guest}.js`, Phase `guestRace`, Test
`test/visual/multiplayer.spec.js` (zwei Tabs). Offen: Der Gast fährt das Auto, das das Feld des
Hosts an Platz 1 hat; Pause beim Host hält den Gast an; verlässt der Host das Rennen, bleibt der
Gast stehen; Touch-Steuerung beim Gast fehlt; Kamera des Gastes ohne den Countdown-Flug.

### Schritt 3: Server und Raum per Link

- Kleiner Node-WebSocket-Dienst (Relay, Räume), eigener Container neben nginx auf beanie.
  Keine IPs zwischen den Spielern (DSGVO), keine Logs mit IPs.
- Raum über Link `?room=xyz`, Host wählt Strecke und Autos, gemeinsamer Countdown.
- Im MP abschalten: Pause, Zeit-Rewind, Switch-Modus, Meisterschaftsfortschritt.

### Schritt 4: Feinschliff

- Vorhersage fürs eigene Auto beim Gast, Abgleich mit dem Host.
- Verbindungsabbruch: KI übernimmt das Auto (dafür `rivalOf(c)` in ai.js).
- KI-Autos im MP-Feld, Namen über den Autos, Ergebnisliste für alle.

### Später, falls nötig: Lockstep

Braucht deterministische `sin/cos/atan/acos` über alle Browser (ändert die Golden Masters) und
`random.fx`, das in `effects.js` ins Rennen wirkt, als Teil der Simulation.
