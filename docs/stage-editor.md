# Stage Editor: Analyse und Plan

Stand: 2026-11-01, Basis 5992d88.

## Was es schon gibt

- **Ein Textformat für Strecken** (`src/data/stageFormat.js`): eine Zeile pro Befehl, z. B.
  `set(10,0,5600,0)p`. `parseStage()` liest es und `writeStage()` schreibt es zurück. Der
  Editor kann also direkt mit der Liste der Einträge arbeiten und genau das Format speichern,
  das die Originalstrecken haben.
- **Strecken aus Text laden** (`src/loading/stageLoad.js`): `readStage(text)` baut aus dem Text
  Teile, Pfad, Checkpoints, Fix-Hoops, Wände und Farben. Das funktioniert schon für die
  Strecken des Originals. Nur `loadStage()` holt den Text fest per Datei
  (`stageFile(track.stage)`).
- **69 Bauteile** (`PIECE_FILES` in `src/loading/assets.js`), im Format um 10 versetzt
  (`set(10,…)` ist `road`). Jedes Modell kennt seine Ausmaße (`bx`, `bz`, `by`) und hat
  Polygone, aus denen sich eine Draufsicht zeichnen lässt.
- **Eine 3D-Vorschau**: Die Streckenauswahl zeigt die Strecke schon von oben im Kreisflug,
  modern und klassisch.

## Worauf es ankommt

| Thema                  | Was die Strecke braucht                                                                                                                                                                                            | Folge für den Editor                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| **Pfad**               | Teile mit Suffix `p`, `pt`, `pr`, `po`, `ph` sind Pfadpunkte. Ihre **Reihenfolge in der Datei** ist die Fahrtrichtung für KI, Platzierung und Minimap.                                                             | Der Editor muss die Reihenfolge des Pfads sichtbar und änderbar machen, nicht nur die Lage der Teile.                         |
| **Checkpoints**        | `chk(...)` zählen in Dateireihenfolge. Luft-Checkpoints (Teil 54) haben eine Höhe.                                                                                                                                 | Checkpoints sitzen auf dem Pfad, zeigen ihre Nummer und haben bei Luft eine Höhe.                                             |
| **Fix-Hoops**          | `fix(...)` haben eine Höhe, `s` macht sie besonders.                                                                                                                                                               | einfaches Teil mit Höhe                                                                                                       |
| **Wände**              | `maxr/maxl/maxt/maxb` ziehen Wände um die Strecke.                                                                                                                                                                 | aus dem Umriss der Strecke **automatisch** berechnen, nicht von Hand                                                          |
| **Aussehen**           | `sky`, `fog`, `clouds`, `ground`, `snap`, `lightswing*`, `distfog`, `nlaps`, `name`                                                                                                                                | eine Einstellungsseite mit Vorlagen aus den vorhandenen Strecken                                                              |
| **Nummer der Strecke** | 218 Stellen in `ai.js`, `physics.js` und `field.js` vergleichen `track.stage` mit festen Nummern (Skripte für einzelne Strecken, Boss, Tutorial). Dazu kommen `levelOf()` (Stärke der Gegner) und `game.unlocked`. | Eigene Strecken bekommen eine Nummer, die keine dieser Regeln trifft. Die Stärke der Gegner ist eine Einstellung der Strecke. |
| **Determinismus**      | Golden Masters und Multiplayer                                                                                                                                                                                     | Der Editor ändert die Simulation nicht. Eine eigene Strecke ist nur ein anderer Text für denselben `readStage()`.             |

## Plan in Schritten

Jeder Schritt ist für sich spielbar, getestet und committet.

### 1. Strecken aus Text statt aus Datei

- `loadStage()` nimmt den Text einer eigenen Strecke, sonst wie bisher die Datei.
- Eine feste Nummer `CUSTOM_STAGE` hinter `STAGE_COUNT`, die keine Regel einer Strecke trifft.
  `levelOf()`, die Musik und die Tipps bekommen dafür einen Fall.
- Eigene Strecken werden im Browser gespeichert (Setting `"myStages"`: Name und Text).
- **Test:** Die Strecke 3 als eigene Strecke geladen fährt bitgleich wie die Strecke 3. Der
  Lauf ist derselbe wie im Golden Master, bis auf die Nummer der Strecke.

### 2. Editor-Grundgerüst: Draufsicht und Teile setzen

- Neue Phase `PHASE.stageEditor`, erreichbar aus dem Hauptmenü ("Stage Editor").
- Ein 2D-Canvas zeigt die Strecke von oben: Raster, Teile als Draufsicht ihrer Modelle,
  Pfad als Linie mit Pfeilen.
- Eine Palette der Teile in Gruppen (Straße, Offroad, Rampen, Kurven, Deko). Eine Teile-Auswahl
  in 3D braucht es nicht.
- Bedienung:
  - setzen, verschieben, drehen (90°-Schritte, mit Taste fein)
  - löschen, Rückgängig/Wiederholen
  - verschieben und zoomen der Ansicht mit Maus, Tastatur **und Touch**
- Einrasten: an einem Raster und an den Enden benachbarter Straßenteile, so dass Straßen ohne
  Lücke aneinanderpassen.

### 3. Pfad, Checkpoints, Fix-Hoops

- Der Pfad folgt der Reihenfolge, in der Teile gesetzt werden, so wie im Stage Maker von NFM2.
  Ein Modus "Pfad" erlaubt, die Reihenfolge zu ändern: Teile der Reihe nach antippen. Pro
  Pfadpunkt lässt sich der Typ wählen (normal, `pt`, `pr`, `po`, `ph`).
- Checkpoints und Luft-Checkpoints mit Höhe, Fix-Hoops mit Höhe.
- **Prüfung vor dem Fahren:** Start vorhanden, mindestens ein Checkpoint, Pfad geschlossen,
  keine Teile außerhalb der Grenzen. Die Fehler stehen als Liste da, ein Klick springt zum
  Teil.

### 4. Einstellungen der Strecke

- Name, Runden, Stärke der Gegner, Musik.
- Himmel, Nebel, Wolken, Boden, Licht und Sichtweite. Als Vorlage dient "wie Strecke X", fein
  einstellbar über Farbwähler.
- Wände automatisch aus dem Umriss plus Rand.

### 5. Ansehen und Probefahren

- 3D-Vorschau wie in der Streckenauswahl, aus dem Editor heraus.
- "Probefahrt" startet ein Übungsrennen auf der Strecke. Danach geht es zurück in den Editor,
  an dieselbe Stelle.

### 6. Verwalten und Teilen

- Liste "Meine Strecken": neu, öffnen, kopieren, umbenennen, löschen.
- Eine vorhandene Strecke (eigene oder Original) als Vorlage öffnen.
- Export und Import als `.txt` im Originalformat, so dass sich auch Strecken aus der
  NFM-Community laden lassen.
- In der Streckenauswahl eine weitere Sammlung "Eigene" neben Modern, NFM 1, NFM 2 und NFM MP.

### 7. Replays und Multiplayer

- Replays einer eigenen Strecke tragen den Text der Strecke im Kopf der Datei, sonst lassen sie
  sich anderswo nicht abspielen.
- Im Multiplayer schickt der Host den Text der Strecke mit dem Start mit (`net/host.js`,
  `isStart` in `net/guest.js`).

## Entscheidungen (2026-11-01)

1. **Umfang:** alle Schritte 1 bis 7 in dieser Runde.
2. **Drehung:** nur 90°-Schritte.
3. **Bedienung:** zuerst am Rechner mit Maus und Tastatur, Touch zum Verschieben und Zoomen.
   Die volle Bedienung am Handy kommt später.
