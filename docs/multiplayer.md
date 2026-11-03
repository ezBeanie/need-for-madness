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

| Bereich                                                              | Stellen | Art                                        | Aufwand               |
| -------------------------------------------------------------------- | ------- | ------------------------------------------ | --------------------- |
| Eingabe `input/controls.js`, `input/gamepad.js`                      | 2       | schreibt Tasten in `racers[game.player].u` | klein                 |
| KI überspringt den Spieler `race/ai.js:247`                          | 1       | `if (c != game.player)`                    | klein                 |
| Physik `race/physics.js`                                             | 17      | gemischt, siehe unten                      | mittel                |
| KI-Verhalten `race/ai.js`                                            | ~69     | KI richtet sich nach _dem_ Spieler         | groß, aber mechanisch |
| HUD `ui/hud.js`                                                      | 42      | Anzeige fürs eigene Auto                   | keiner (bleibt lokal) |
| Kamera, Motorgeräusch, `drawFrame`, Countdown                        | ~10     | Anzeige fürs eigene Auto                   | keiner bzw. klein     |
| Standings, Recording, Highlights                                     | ~10     | Kameraeffekte ums eigene Auto              | keiner (lokal)        |
| Meta: Meisterschaft, Freischalten, `raceEnd`, Autowahl `carTypes[0]` | ~10     | Einzelspieler-Fortschritt                  | im MP abschalten      |

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

Die KI ist um _einen_ Menschen gebaut: Gummiband nach `rank(game.player)` (ai.js:1860, 1895),
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
`test/visual/multiplayer.spec.js` (zwei Tabs). Danach ergänzt: Der Gast fährt sein
eigenes Auto, sieht den Countdown-Flug, bekommt "Waiting for the host..." bei Pause und "The host
left the race", wenn der Host geht; ein Gast, der 100 Ticks schweigt, gilt als gegangen.
Offen: Touch-Steuerung beim Gast.

### Schritt 3: Server und Raum per Link

- Kleiner Node-WebSocket-Dienst (Relay, Räume), eigener Container neben nginx auf beanie.
  Keine IPs zwischen den Spielern (DSGVO), keine Logs mit IPs.
- Raum über Link `?room=xyz`, Host wählt Strecke und Autos, gemeinsamer Countdown.
- Im MP abschalten: Pause, Zeit-Rewind, Switch-Modus, Meisterschaftsfortschritt.

Stand nach Schritt 3: `server/relay.js` (Räume, max. 8 Spiele pro Raum, 200 Räume, 256 KB pro
Nachricht, 120 Nachrichten/s pro Spiel, Kompression, kein Logging), im Dev-Server per Vite-Plugin
unter `/net`, eigenständig mit `node server/main.js`. Eine Tick-Nachricht sind unkomprimiert
etwa 2,9 KB bei 7 Autos (80 KB/s) und 7,3 KB bei 20 Autos (200 KB/s).

Deployment auf beanie (seit 29.10.2026 live):

- Relay: Quellen nach `/home/janu/nfm-relay` (`package.json`, `package-lock.json`, `server/`),
  dort `docker build -f server/Dockerfile -t nfm-relay .`, Container
  `docker run -d --name nfm-relay --restart unless-stopped -p 127.0.0.1:8787:8787 nfm-relay`.
- Übersicht `lobbies.html`: Der Relay beantwortet `/net/rooms` nur mit dem Token aus
  `ROOMS_TOKEN` (ohne gesetzten Token gar nicht). Der Token kommt aus einer Env-Datei, die nur
  auf beanie liegt und nie ins Repository gehört, z. B. `--env-file /home/janu/nfm-relay.env`
  mit `ROOMS_TOKEN=…`. Die Seite fragt einmal danach und merkt ihn sich im Browser.
- nginx: Container `nfm` im Host-Netz, damit das Access-Log die echten Absender zeigt (über
  Dockers Port-Weiterleitung stand dort nur das Docker-Gateway):
  `docker run -d --name nfm --restart unless-stopped --network host -v /home/janu/nfm:/usr/share/nginx/html:ro -v /home/janu/nfm-nginx/default.conf:/etc/nginx/conf.d/default.conf:ro -v /home/janu/nfm-logs:/var/log/nginx nginx:alpine`.
- `/home/janu/nfm-nginx/default.conf` hört auf 8090 und reicht `/net` ohne Access-Log weiter:

  ```nginx
  location /net {
    access_log off;
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 120s;
  }
  ```

- Logs in `/home/janu/nfm-logs`, Rotation nach 7 Tagen per
  `/home/janu/nfm-nginx/logrotate.conf` (der tägliche Cronjob dafür ist Sache des Besitzers).
- Spiel wie bisher: `npm run build`, `rsync -az --delete dist/ beanie-ts:/home/janu/nfm/`.

Im Menü: Der Knopf „Multiplayer“ neben dem Zahnrad (Hauptmenü, Auto- und Streckenwahl) öffnet
einen Dialog (`src/ui/multiplayerMenu.js`). „Host a race“ öffnet einen Raum mit einem Code aus
5 Zeichen und zeigt den Link für den Gast; der Gast gibt den Code ein. Der Host antwortet auf
jedes `join` mit `players` (siehe Schritt 6), so sieht jede Seite, ob die andere da ist. `?host=`/`?join=` gehen
weiterhin.

### Schritt 4: Feinschliff

- Vorhersage fürs eigene Auto beim Gast (`prediction.js`): ersetzt durch Schritt 5.
- Verbindungsabbruch: KI übernimmt das Auto (dafür `rivalOf(c)` in ai.js).
- KI-Autos im MP-Feld, Namen über den Autos, Ergebnisliste für alle.

### Schritt 5: Rollback-Netcode

Beide Spiele rechnen das ganze Rennen und tauschen nur Tasten aus. Kommen Tasten des anderen
zu spät, spult ein Spiel zum Tick zurück, an dem sie gedrückt wurden, und rechnet neu.

- Harter Determinismus: `sin/cos/atan/acos` aus `core/exactMath.js` (fdlibm), über `?determinism`
  zwischen Geräten vergleichbar.
- Rennzustand speichern und zurückholen (`net/raceState.js`): Autos (inklusive Matrix, die die
  Physik im nächsten Tick liest), Tasten (die KI drückt sie einen Tick vorher), Beulen der
  Karosserie (sie bestimmen den Schaden des nächsten Treffers), KI, Wertung, Rennereignisse,
  `random.sim`, `random.wreck` und der Takt. Was nur zu sehen oder zu hören ist, bleibt außen
  vor. `random.wreck` ist der eine Zug aus den Effekten, der ins Rennen wirkt (Streckung des
  Wracks); er ist von `random.fx` getrennt, weil das Zeichnen `random.fx` je nach
  Bildwiederholrate unterschiedlich oft zieht. Test: `test/raceState.test.js`.
- Ein Rennen mit zwei Menschen rechnet in beiden Spielen gleich (`test/sharedRace.test.js`): Die
  KI fährt gegen das Auto des Hosts (`aiRival()`), und was das Original im HUD des Spielers
  erledigt (Zähler von „Check Point Missed!“, Verbrauch der Stunt-Drehungen, Rennende), erledigt
  bei mehreren Menschen das Rennen für jedes menschliche Auto. Im Einzelspiel bleibt alles beim
  Original, die Golden Masters sind unverändert.
- Lockstep (`net/lockstep.js`): Mit dem ersten Tick des Rennens schickt der Host dessen ganzen
  Zustand (`start`), der Gast lädt die Strecke und setzt ihn ein. Danach schicken beide pro Tick
  nur ihre Tasten (`keys`), die 3 Ticks (105 ms) später wirken, in beiden Spielen gleich. Fehlen
  die Tasten des anderen, wartet der Tick („Waiting for player 2/the host...“, Pause geht weiter).
  Der Gast fährt ein echtes Rennen mit eigenem HUD, Warnungen, Sounds und Rennende; seine eigene
  Phase und Vorhersage sind weg. Geht einer, fährt die KI dessen Auto, der andere fährt weiter.
- Nachrichten gehen bitgenau (`encode`/`decode` in `link.js`): JSON verliert sonst -0, NaN,
  Unendlich und undefined in Listen.
- Desync-Prüfung: Jede Sekunde (30 Frames) schicken beide einen FNV-Fingerabdruck des gemeinsamen
  Rennzustands (`sync`, `sharedRace()` in `raceState.js`). Weichen sie ab, zeigen beide
  „Out of sync!“ und die Konsole den ersten abweichenden Frame (`lockstep.apartAt`).
- Rollback: Die Tasten wirken nur noch 1 Frame (35 ms) später. Fehlen die Tasten des anderen,
  rät das Spiel sie (die zuletzt gedrückten) und fährt weiter, bis zu 8 Frames (280 ms), erst dann
  wartet es. Vor jedem geratenen Frame hält es Rennen, Aufnahme und Länge des Replay-Bands fest.
  Kommen die echten Tasten anders, spult es zum ersten falsch geratenen Frame zurück und rechnet
  bis jetzt still neu (`physics.quiet`: keine Sounds, keine Effekte; Regeln und Aufnahme laufen).
  Im Countdown zählen Tasten nicht, dort wird nie zurückgespult. Fingerabdrücke gehen erst raus,
  wenn ihr Frame nicht mehr auf geratenen Tasten steht.
- Gesichert werden von den Rennereignissen nur noch `countdown` und `onautocorrect`; der Rest
  gehört dem HUD des jeweiligen Spielers und bleibt beim Zurückspulen stehen.
- Staub, Funken und Rutschgeräusche im Replay kommen aus dem Effekt-Zufall und sind ohnehin in
  jedem Spiel anders; Staub und Funken neu gerechneter Frames fehlen im Replay.

### Schritt 6: Raum für bis zu 8 Spieler, Lobby, mehrere Rennen

- Jedes Spiel bekommt beim Betreten eines Raums eine zufällige ID aus 8 Zeichen (`link.id`),
  jede Nachricht trägt sie als `from`. Sie sagt nichts über den Spieler aus.
- Lobby: Gäste schicken im Menü alle 30 Ticks `join` mit ihrem Auto, der Host antwortet mit
  `players` (alle Spieler mit Auto, Host zuerst). Der Dialog listet sie. Höchstens 8 pro Raum
  (wie das Relay; einen neunten schließt es mit Code 4001, der Dialog sagt „The room is full“).
  Ein Gast, der 100 Ticks schweigt oder `bye` schickt, fliegt aus der Liste.
- Rennstart: Der Host nimmt die Gäste mit, die gerade im Menü sind (`join` in den letzten 60
  Ticks). Spieler i fährt Auto i (Host 0); ist das Feld kleiner, wächst es. `start` trägt die
  IDs nach Auto und eine `raceId`; Rennnachrichten tragen sie mit, so stören Nachrichten eines
  alten Rennens kein neues.
- Lockstep für N Spieler: Tasten, Raten und Warten pro Spieler; zurückgespult wird zum frühesten
  falsch geratenen Frame. Fingerabdrücke gehen an alle, verglichen wird mit jedem.
- Aussteigen: Wer das Rennen verlässt, schickt `left` mit dem Frame nach seinen letzten Tasten;
  ab da fährt die KI sein Auto, in jedem Spiel gleich (`game.humans` pro Frame). Wer schon weiter
  gerechnet hat, spult zurück. Ein Spieler, von dem 100 Ticks nichts kommt (alle Spiele pingen
  im Rennen alle 30 Ticks), gilt als ausgestiegen ab dem Frame nach seinen letzten Tasten.
  Test: `test/rollback.test.js`.
- Nach dem Rennen sind alle wieder im Menü und im Raum; der Host startet das nächste.
- Keine Pause im gemeinsamen Rennen: Escape (oder der Pause-Knopf) öffnet das Menü über dem
  weiterlaufenden Rennen, nur mit „Resume“ und „Leave Race“. Solange es offen ist, rollt das eigene
  Auto ohne Tasten weiter; die anderen warten nicht.
- Verlässt der Host den Raum (`bye`, oder er schweigt 100 Ticks), endet der Raum für die Gäste,
  sobald sie wieder im Menü sind: Der Dialog öffnet sich mit „The host left the room.“
- Echtzeit-Test gegen den Dev-Server (drei bzw. acht Browser-Kontexte, je eigenes Spiel):
  zwei Rennen zu dritt, einer steigt aus, der Host geht; acht in einem Rennen, einem reißt die
  Verbindung ab. Alle Fingerabdrücke gleich, das abgerissene Auto ab demselben Frame bei der KI.

Spieltest 2026-11-01 mit vier Geräten (iPhone als Host, S24, iPad, Laptop): Ein Desync kam vom
Freischaltstand, der pro Gerät verschieden ist und die Hilfe auf der neuesten Strecke steuerte;
im gemeinsamen Rennen gibt es sie nicht mehr (`onNewestStage`). Danach vier Spieler ohne Desync.

### Offen

- **Querformat auf iOS:** Web-Apps können die Drehung dort nicht sperren; bisher ein Hinweis im
  Hochformat. Möglich: das Spiel im Hochformat selbst um 90° drehen, oder eine App-Hülle.
- Bandbreite (Tasten als Bits, nur bei Änderung), Namen über den Autos, Ergebnisliste für alle.

### Schritt 7: Hintergrund, Bots in der Lobby

- Ein verstecktes Spiel (anderer Tab, andere App) rechnet und pingt nicht; die anderen hielten
  es nach 100 Ticks für ausgestiegen, während es danach weiterfuhr. Jetzt verlässt es das
  Rennen beim Verstecken sofort (`left`, wie „Leave Race“), auch während die Strecke noch lädt
  (der Start wird dann verworfen). Zurück ist es im Menü und im Raum.
- `?determinism` schaltet die Landehilfe neuer Spieler ab wie der Host; die Hashes hängen nicht
  mehr vom gespeicherten Auto ab.
- Lobby: Mit Gästen fahren im Raum nur die Spieler (`field.roomCarTypes`), keine KI zum
  Auffüllen. Der Host fügt im Dialog Bots hinzu („Add a bot“), wählt je Bot ein Auto und
  entfernt sie wieder; `players` trägt die Bots mit, die Gäste listen sie. Bots fahren mit der
  KI wie bisher (Stärke nach Strecke). Ohne Gäste fährt der Host allein mit dem üblichen Feld.

### Schritt 8: Lobby

- Der Multiplayer-Dialog ist im Raum eine Lobby: Spieler mit Auto und „Ready“, Bots, die
  Strecke, das eigene Auto und ein Chat. Der Host wählt die Strecke aus den Strecken des Spiels
  und des Originals (die eigenen Strecken hat nur das eigene Gerät) und startet, sobald alle
  Gäste bereit sind; das Rennen startet direkt aus dem Laden (`AFTER_LOAD.room`).
- `join` trägt `ready`, `players` trägt `ready` je Spieler und die gewählte `stage`. Nach jedem
  Rennen ist niemand mehr bereit, und die Lobby geht wieder auf.
- Chat: `chat`-Nachrichten gehen an alle im Raum, ohne Steuerzeichen, höchstens 200 Zeichen,
  die letzten 50 Zeilen bleiben (`net/chat.js`). Angezeigt nur als Text.
- Mit Bots und ohne Gäste fährt der Host jetzt mit den Bots statt mit dem Feld der Strecke.
- Das gemeinsame Rennen hat eigene Einstellungen (`RACE_KIND.together`): keine Hilfe der
  neuesten Strecke, KI nach der Strecke, in jedem Spiel gleich.

### Schritt 9: Namen, Lacke, Zuschauen, Voice Chat

- Namen: In den Optionen (Abschnitt „Multiplayer“) legt jeder Spieler einen Namen fest
  (höchstens 16 Zeichen, ohne Steuerzeichen, `net/roomCars.js`). `join` und `players` tragen
  `name` und `skin`, Bots sind `{ carType, skin }`. `start` trägt `names` (je Auto, `null` für
  Bots) und `skins`. Ohne Namen heißt ein Spieler „Player n“, Bots „Bot n“. Die Namen stehen
  im Rennen über den Autos (`ui/nameTags.js`, außer über dem eigenen und dem verfolgten), im
  Replay und in „… finished first“.
- Lacke: In der Lobby wählt jeder Spieler und der Host je Bot einen Lack (`render/skins.js`):
  farbige Teile bekommen den Farbton, Schwarz oder Weiß; graue Teile, Reifen und Scheiben
  bleiben. Im modernen Look färbt `raceCarTextures` die Textur des Autos (eigene Kopie wie bei
  zweimal demselben Auto), im klassischen Look `paintRad` die Polygone. Rein optisch: die
  Golden Masters bleiben gleich.
- Zuschauen: Ist das eigene Auto im gemeinsamen Rennen zerstört, folgt die Kamera nach dem
  Wrack den Autos, die noch fahren (`race/spectate.js`), mit „< Before“, „Next >“ oder durch
  Lenken; der Kameraflug ist der des Replay-Players (`followCar`).
- Raumklang: Die Geräusche der anderen Autos (Crashs, Kratzen, Rutschen) kommen über einen
  HRTF-Panner aus ihrer Richtung, auch von vorn oder hinten (`heardFrom` mit `front`). Im
  modernen Look haben die anderen Autos eigene Motoren (`audio/otherEngines.js`), leiser mit
  der Entfernung, höher mit der Geschwindigkeit; ihre Sounds laden getrennt vom eigenen Motor,
  weil dessen Start entscheidet, welche Zufallszahlen die Effekte bekommen.
- Voice Chat (`net/voice.js`): je zwei Spiele eines Raums direkt per WebRTC, ausgehandelt über
  `voice`-Nachrichten des Relays (das Spiel mit der kleineren Id bietet an). Push-to-talk: im
  Rennen Taste P, in der Lobby „Hold to talk“; das Mikrofon wird beim ersten Drücken erfragt.
  Im Rennen kommt jede Stimme von ihrem Auto, leiser mit der Entfernung; in der Lobby alle
  gleich laut. In den Optionen abschaltbar. Die Mitspieler sehen dabei gegenseitig ihre
  IP-Adressen (so steht es auch in den Optionen).
- STUN/TURN: Das Relay gibt unter `/net/ice` die Server und einen Tag lang gültige
  TURN-Zugangsdaten heraus (`server/ice.js`, coturn mit `use-auth-secret`). Dazu braucht das
  Relay `TURN_HOST` (nur STUN) und für TURN zusätzlich `TURN_SECRET` in seiner Env-Datei auf
  beanie; ohne `TURN_HOST` finden sich die Spiele nur im selben Netz. coturn läuft als eigener
  Container auf beanie; Port 3478 (UDP und TCP) muss im Router freigegeben sein, für TURN
  zusätzlich ein Portbereich für die Weiterleitung. STUN allein reicht in den meisten
  Heimnetzen; TURN braucht es für Mobilfunk und strenge Firewalls, und coturn muss dafür die
  öffentliche Adresse kennen, die bei beanie wechselt (DynDNS).
