# Hauptmenü: Analyse und Plan

Stand: 2026-11-03, Basis b7d5223. Umgesetzt: Schritte 1 bis 8 (siehe „Stand“ am Ende).

## Ziel

Ein Hauptmenü mit diesen Punkten:

- **Kampagne**: die Strecken des Spiels mit Fortschritt, wie die heutige Karriere.
- **Schnelles Rennen**: Strecke, Auto, Feldgröße und Stärke der KI frei wählbar.
- **Übung**: ein Auto allein auf einer beliebigen Strecke.
- **Time Attack**: Runden- und Gesamtzeit mit Bestzeiten je Strecke.
- **Multiplayer**: Raum hosten oder per Code beitreten, später eine Liste offener Lobbys.
- **Streckeneditor**
- **Autoeditor**: ein eigenes Vorhaben mit eigenem Plan.
- **Optionen**

Entscheidungen des Users:

- Die Menüs werden HTML-Bildschirme über der animierten Szene auf dem Canvas.
- „Schnelles Rennen“ ist ein eigener Punkt. „Übung“ bleibt ein Auto allein.
- In der Kampagne bleibt die Schwierigkeit wie im Original. Überall sonst ist sie wählbar, und
  die Hilfe auf der neuesten Strecke gibt es dort nicht.

## Was es schon gibt

- **Hauptmenü** (`src/screens/mainMenu.js`): Es ist auf den Canvas gezeichnet und hat die Knöpfe
  PLAY, Anleitung, Replay öffnen, Spiel zurücksetzen und Musik. PLAY führt in die
  Autowahl und von dort in die Streckenwahl.
- **Streckenwahl** (`src/screens/stageSelect.js`): Sammlungen (Spiel, Original, eigene), Feldgröße,
  „Practice“ (ein Auto allein) und „PLAY SWITCH“ (Switch-Modus).
- **Dialoge** in `index.html` (`.menu-dialog`): Optionen, Multiplayer, Dialoge des Streckeneditors.
  Bedienung mit Tastatur und Touch, a11y.
- **Karriere** (`src/race/career.js`): Ist sie aus, setzt sie `game.unlocked = LAST_STAGE`, und
  alles ist offen.

## Woran der Fortschritt hängt

`game.unlocked` ist zugleich Fortschritt und Schwierigkeit:

| Stelle                                                     | Wirkung                                                                     |
| ---------------------------------------------------------- | --------------------------------------------------------------------------- |
| `onNewestStage()` (`core/state.js`), `physics.js`, `ai.js` | Hilfen auf der neuesten Strecke: Strom, Aufrichten, KI rempelt weniger      |
| `field.js`                                                 | Gegnerwahl: Regeln für neue Strecken, keine Autos, die noch nicht frei sind |
| `stageLoad.js:240`, `countdown.js`, `hud.js`               | Tipps und Tutorial auf den ersten Strecken                                  |
| `raceEnd.js`, `hud.js:775`                                 | Fortschritt nach einem Sieg                                                 |
| `carSelect.js`, `stageSelect.js`                           | was wählbar ist                                                             |

Die Stärke der KI selbst hängt an `track.stage` (`ai.js`, 204 Stellen). Die meisten sind
Skripte für einzelne Strecken. Allgemein sind nur drei Regler: `chooseAimLag` (zielt
ungenauer), `chooseHoldBack` (bremst sich auf Strecke 1–4 hinter dem Spieler ein) und
`chooseCornerCutting` (Strecke 1–5). `levelOf()` gilt heute nur für die Gegnerwahl.

## Plan in Schritten

Jeder Schritt ist für sich spielbar, getestet und committet. Die Golden Masters bleiben
bitgleich: Die Kampagne behält genau die heutigen Werte.

### 1. Menügerüst

- Das Hauptmenü wird ein HTML-Bildschirm über der Szene. Der Canvas zeigt weiter Logo und
  Animation, aber keine Knöpfe mehr.
- Die Menüpunkte führen zunächst in die vorhandenen Abläufe: Kampagne in Autowahl und
  Streckenwahl, Multiplayer, Streckeneditor und Optionen in ihre Dialoge. Anleitung und
  „Replay öffnen“ bekommen einen kleinen Platz im Menü. Punkte, die es noch nicht gibt, fehlen.
- Untermenüs öffnen sich als eigene Bildschirme mit „Zurück“ (Esc), der Fokus kehrt auf den Punkt
  zurück, von dem man kam.
- Mit den Menüs des Originals (klassischer Look und Taste U, `classicMenus()`) bleibt das Hauptmenü des Originals.

### 2. Einstellungen des Rennens

- Ein Rennen bekommt seine Einstellungen mit: Art (Kampagne, Schnelles Rennen, Übung, Time Attack,
  Multiplayer), Stufe der KI und ob es die Hilfe auf der neuesten Strecke gibt.
- Die Simulation liest diese Einstellungen statt `game.unlocked`. `onNewestStage()` wird zu einer
  Frage an die Einstellungen; der Multiplayer setzt sie für alle Spiele gleich.
- Die Stufe der KI ist eine Strecke (1–17), deren Regler gelten: Leicht, Normal (die Stufe der Strecke
  selbst, `levelOf()`), Schwer. Die Skripte der einzelnen Strecken bleiben an `track.stage`.

### 3. Kampagne

- Immer mit Fortschritt. Der Schalter „Karriere“ in den Optionen entfällt. Der gespeicherte
  Fortschritt bleibt.

### 4. Schnelles Rennen

- Alle Strecken und Autos offen, Feldgröße und Stärke wählbar. Die Feldgröße wandert von der
  Streckenwahl hierher.

### 5. Übung

- Der heutige „Practice“-Knopf wird ein Menüpunkt: ein Auto allein, ohne Fortschritt.

### 6. Time Attack

- Allein auf der Strecke, Zeit in Ticks gemessen und damit genau. Rundenzeit und Gesamtzeit im HUD,
  Bestzeiten je Strecke gespeichert.
- Später möglich: ein Geist der Bestzeit aus den Replay-Daten.

### 7. Multiplayer

- Ein Bildschirm statt des Dialogs: hosten oder per Code beitreten, Raum mit Spielern und Bots.
- Danach die Liste offener Lobbys. Dafür muss der Relay Räume öffentlich auflisten können.

### 8. Optionen

- Ein Bildschirm mit Gruppen: Look, Darstellung (Polygonsortierung, Pixel), Kamera, Ton, Steuerung.

### 9. Autoeditor

- Eigener Plan, wenn die Schritte davor stehen.

## Stand

- **1** Hauptmenü als HTML (`#mainMenu`, ein `<nav>`): Kampagne, Schnelles Rennen, Übung, Time
  Attack, Multiplayer, darunter zwei mal zwei kleinere Knöpfe. Pfeiltasten gehen durch das Menü,
  ein Gamepad-Knopf wählt den fokussierten Eintrag. Mit den Menüs des Originals bleibt dessen
  Hauptmenü.
- **2** `raceSetup` (`core/state.js`) statt `game.unlocked` im Rennen: neueste Strecke, offene
  Autos, KI-Stufe. `setUpRace()` (`race/career.js`) beim Laden jeder Strecke.
- **3** Die Kampagne hat immer Fortschritt und 7 Autos, nur die Strecken des Spiels, nicht weiter
  als freigeschaltet. Der Schalter „Career“ ist weg.
- **4** Schnelles Rennen: alle Sammlungen, Feldgröße (C) und KI-Stärke (B: Easy, Normal, Hard;
  Leicht fährt wie Strecke 1, Normal wie die Strecke, Hard wie Strecke 17).
- **5** Übung: allein, jede Strecke.
- **6** Time Attack (`race/timeAttack.js`): allein, Uhr in Ticks, Runden- und Gesamtzeit im HUD,
  Bestzeiten je Strecke in `bestTimes`, in der Streckenwahl angezeigt; kein Zurückspulen.
- **7** Lobby, siehe `docs/multiplayer.md`, Schritt 8.
- **8** Optionen in Gruppen: Look (Look, Menüs, Pixel, Polygonsortierung), Rennen (Kamera,
  Minimap), Ton.
- **9** Autoeditor: noch offen.
