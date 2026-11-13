// The game's texts in German, each under its English (see core/language.js): {name} stands
// for what the code puts in. A text missing here shows in English. Words German players
// use as they are (Stage, Bots, Ping, Replay, Kills) stay.

export const GERMAN = {
  // the page: main menu
  "Loading, please wait...": "Lädt, bitte warten...",
  "Main menu": "Hauptmenü",
  Campaign: "Kampagne",
  "Quick Race": "Schnelles Rennen",
  Practice: "Training",
  "Time Attack": "Zeitfahren",
  Multiplayer: "Mehrspieler",
  "Stage Editor": "Stage-Editor",
  Options: "Optionen",
  Instructions: "Anleitung",
  "Open Replay": "Replay öffnen",
  "Reset Game": "Zurücksetzen",

  // the options
  Back: "Zurück",
  Language: "Sprache",
  "Game language": "Spielsprache",
  Look: "Aussehen",
  "Classic menus and HUD": "Klassische Menüs und HUD",
  "Classic pixels": "Klassische Pixel",
  Racing: "Rennen",
  "Camera turns to a car you choose": "Kamera dreht sich zum gewählten Auto",
  "In a race tap a car, or use the bar's arrows, F (nearer: Shift+F) or the right stick, nearest first; a click on the left stick lets go. Wasted cars can't be chosen. With none chosen the camera stays behind your car.":
    "Tippe im Rennen auf ein Auto oder nimm die Pfeile der Leiste, F (näher: Shift+F) oder den rechten Stick, das nächste zuerst; ein Klick auf den linken Stick lässt los. Geschrottete Autos kann man nicht wählen. Ohne Wahl bleibt die Kamera hinter deinem Auto.",
  Minimap: "Minikarte",
  "Stunts begin with the handbrake": "Stunts beginnen mit der Handbremse",
  "In the air press Space (the handbrake) first, then the arrows turn the car. Off: as in the original, an arrow pressed in the air begins a stunt.":
    "Drück in der Luft zuerst die Leertaste (die Handbremse), dann drehen die Pfeile das Auto. Aus: Wie im Original beginnt ein in der Luft gedrückter Pfeil einen Stunt.",
  Collisions: "Kollisionen",
  "Solid, no ramps: cars never pass through each other, and a car lifts another only in a crash. Solid: a touch lifts too. Original: as the original game. Hosting a room, the lobby begins with yours.":
    "Fest, ohne Rampen: Autos fahren nie durcheinander hindurch, und ein Auto hebt ein anderes nur bei einem Crash an. Fest: Auch eine Berührung hebt an. Original: wie im Originalspiel. Hostest du einen Raum, beginnt die Lobby mit deiner Wahl.",
  Solid: "Fest",
  "Solid, no ramps": "Fest, ohne Rampen",
  "Ghost in time attack": "Geist im Zeitfahren",
  "Your fastest race on the stage, driven again beside you.":
    "Dein schnellstes Rennen auf der Stage, noch einmal neben dir gefahren.",
  "Touch controls": "Touch-Steuerung",
  Size: "Größe",
  "Arrange the controls": "Steuerung anordnen",
  "Drag each control where your thumbs want it.":
    "Zieh jedes Bedienelement dorthin, wo deine Daumen es haben wollen.",
  Sound: "Ton",
  Music: "Musik",
  "Other cars' sounds": "Geräusche der anderen",
  "Music volume": "Musiklautstärke",
  "Effects volume": "Effektlautstärke",
  "Your name": "Dein Name",
  "The others in a room see it on your car.":
    "Die anderen im Raum sehen ihn an deinem Auto.",
  "Voice chat": "Sprachchat",
  "Voices go straight between the players' games, which so learn each other's internet address.":
    "Stimmen gehen direkt zwischen den Spielen der Spieler hin und her, die so die Internetadresse der anderen erfahren.",
  Talk: "Sprechen",
  "Push to talk: hold P in a race, the Talk button in the lobby. By voice: the others hear you whenever you speak, your microphone open all the time in a room.":
    "Push-to-Talk: Halte im Rennen P, in der Lobby den Sprechen-Knopf. Per Stimme: Die anderen hören dich, sobald du sprichst, dein Mikrofon ist in einem Raum die ganze Zeit offen.",
  "Race music offline": "Rennmusik offline",
  "Keeps every stage's music for races without the network. Off removes it again.":
    "Behält die Musik jeder Stage für Rennen ohne Netz. Aus entfernt sie wieder.",
  About: "Über das Spiel",
  "What's new": "Neuigkeiten",
  On: "An",
  Off: "Aus",
  Classic: "Klassisch",
  Sharp: "Scharf",
  "Original pixels": "Originalpixel",
  "By voice": "Per Stimme",
  "Push to talk": "Push-to-Talk",
  "Getting the game ready to play without the network: {percent}%":
    "Das Spiel wird für das Spielen ohne Netz vorbereitet: {percent} %",
  "Ready to play without the network.": "Bereit zum Spielen ohne Netz.",
  "Not ready yet: it gets ready while the game runs with the network.":
    "Noch nicht bereit: Das passiert, während das Spiel mit Netz läuft.",
  "{kept} of {total}": "{kept} von {total}",
  "{kept} of {total}, the rest with the network":
    "{kept} von {total}, der Rest über das Netz",

  // the stage editor
  Undo: "Rückgängig",
  Redo: "Wiederholen",
  "Turn (R)": "Drehen (R)",
  Turn: "Drehen",
  "Delete (Del)": "Löschen (Entf)",
  Delete: "Löschen",
  "Order path (O)": "Pfad ordnen (O)",
  "Order path": "Pfad ordnen",
  "3D view (V)": "3D-Ansicht (V)",
  "3D view": "3D-Ansicht",
  Settings: "Optionen",
  "Test drive (T)": "Testen (T)",
  "Test drive": "Testen",
  Help: "Hilfe",
  "Help (?)": "Hilfe (?)",
  Close: "Schließen",
  Pieces: "Teile",
  "The stage from above": "Die Stage von oben",
  "The stage in 3D, flown over": "Die Stage in 3D, im Überflug",
  "Selected piece and problems": "Gewähltes Teil und Probleme",
  Selected: "Ausgewählt",
  "As on the map: its top is ahead.": "Wie auf der Karte: Oben ist vorn.",
  Path: "Pfad",
  Reverse: "Umkehren",
  "Order by place": "Nach Lage ordnen",
  "From the start, each time to the nearest point.":
    "Vom Start aus jeweils zum nächstgelegenen Punkt.",
  Check: "Prüfung",
  "Your stages": "Deine Stages",
  "They race in the stage select's Own collection.":
    "Gefahren werden sie in der Stage-Auswahl unter „Eigene“.",
  "New stage": "Neue Stage",
  "Start from": "Beginnen mit",
  "Copy stage": "Stage kopieren",
  "Open a stage file (.txt, also the original game's)":
    "Stage-Datei öffnen (.txt, auch die des Originalspiels)",
  "Save this stage as a file": "Diese Stage als Datei speichern",
  Done: "Fertig",
  "How the editor works": "So funktioniert der Editor",
  "The path": "Der Pfad",
  "The path is the way the cars go round: the computer cars drive from one point of it to the next, and the checkpoints count in its order. On the map it is the light blue line, its arrows point the way, the white square is the start, and every point has its number.":
    "Der Pfad ist der Weg, den die Autos fahren: Die Computerautos fahren von einem seiner Punkte zum nächsten, und die Checkpoints zählen in seiner Reihenfolge. Auf der Karte ist er die hellblaue Linie, seine Pfeile zeigen die Richtung, das weiße Quadrat ist der Start, und jeder Punkt hat seine Nummer.",
  "A road dropped onto the end of another joins it and follows it on the path by itself. Build the lap end to end from the start, and the path builds itself.":
    "Eine Straße, die ans Ende einer anderen gesetzt wird, schließt an und folgt ihr von selbst auf dem Pfad. Bau die Runde vom Start aus Stück für Stück, und der Pfad baut sich selbst.",
  "A piece dropped anywhere else goes to the end of the path. Put it in its place with":
    "Ein woanders gesetztes Teil kommt ans Ende des Pfads. Bring es an seinen Platz mit",
  ": click the pieces one after another the way the cars drive, the start first.":
    ": Klick die Teile nacheinander in Fahrtrichtung an, den Start zuerst.",
  "Or select a point and move it earlier or later on the path, or make it the start.":
    "Oder wähl einen Punkt und verschieb ihn auf dem Pfad nach vorn oder hinten, oder mach ihn zum Start.",
  "The list under": "Die Liste unter",
  "on the right has every point in order: click one to select it, the arrows move it a step.":
    "rechts zeigt jeden Punkt der Reihe nach: Klick einen an, um ihn zu wählen, die Pfeile verschieben ihn um einen Schritt.",
  "sends the cars round the other way,": "schickt die Autos andersherum,",
  "goes from the start each time to the nearest point.":
    "geht vom Start aus jeweils zum nächstgelegenen Punkt.",
  "A point's kind tells the computer cars how to drive it: a corner they may cut, a ramp they drive straight at, a point they may leave out. Trees and other scenery are not on the path.":
    "Die Art eines Punkts sagt den Computerautos, wie sie ihn fahren: eine Kurve, die sie schneiden dürfen, eine Rampe, auf die sie gerade zufahren, ein Punkt, den sie auslassen dürfen. Bäume und andere Kulisse liegen nicht auf dem Pfad.",
  "A lap needs a start piece at the middle of the map, a checkpoint and three points.":
    "Eine Runde braucht ein Startteil in der Mitte der Karte, einen Checkpoint und drei Punkte.",
  ") shows the stage as it races, the selected piece flashing. Fly with":
    ") zeigt die Stage wie im Rennen, das gewählte Teil blinkt. Flieg mit",
  and: "und",
  "down and up,": "runter und hoch,",
  "faster; drag to look round, scroll to move forward and back.":
    "schneller; ziehen zum Umsehen, scrollen für vor und zurück.",
  "See in 3D": "In 3D ansehen",
  "puts the camera behind the selected piece. A fix hoop's or an air checkpoint's height has a slider.":
    "setzt die Kamera hinter das gewählte Teil. Die Höhe eines Reparaturrings oder Luft-Checkpoints hat einen Regler.",
  "The piece being placed or selected shows on the right as it lies on the map: its top is ahead.":
    "Das Teil, das gesetzt oder gewählt wird, zeigt sich rechts so, wie es auf der Karte liegt: Oben ist vorn.",
  Keys: "Tasten",
  "Turn the piece (or the one being placed) right / left":
    "Das Teil (oder das zu setzende) nach rechts / links drehen",
  Del: "Entf",
  "Take the piece away": "Das Teil entfernen",
  "Place another of the selected piece, turned the same":
    "Noch eins vom gewählten Teil setzen, gleich gedreht",
  "Arrow keys": "Pfeiltasten",
  "Move the piece (with": "Das Teil verschieben (mit",
  "further), or the map when nothing is selected":
    "weiter), oder die Karte, wenn nichts gewählt ist",
  "Select the path's point before / after":
    "Den Pfadpunkt davor / danach wählen",
  "Move the point earlier / later on the path":
    "Den Punkt auf dem Pfad nach vorn / hinten schieben",
  "Make the point the path's start": "Den Punkt zum Start des Pfads machen",
  "Change the point's kind": "Die Art des Punkts ändern",
  "Order the path by clicking": "Den Pfad per Klick ordnen",
  "Show the whole stage": "Die ganze Stage zeigen",
  "The 3D view, or the map": "Die 3D-Ansicht oder die Karte",
  "Zoom in / out (or the mouse wheel)": "Rein- / rauszoomen (oder das Mausrad)",
  Ctrl: "Strg",
  "Undo / redo": "Rückgängig / wiederholen",
  "Stop placing or ordering, deselect, then close":
    "Setzen oder Ordnen beenden, Auswahl aufheben, dann schließen",
  "This help": "Diese Hilfe",
  "Stage settings": "Stage-Einstellungen",
  Laps: "Runden",
  "Opponents as strong as on": "Gegner so stark wie auf",
  "Music of": "Musik von",
  "Look like": "Aussehen wie",
  "Copy look": "Aussehen kopieren",
  Sky: "Himmel",
  Fog: "Nebel",
  Ground: "Boden",
  Clouds: "Wolken",
  "Cloud cover": "Bewölkung",
  Overcast: "Bedeckt",
  Cloudy: "Bewölkt",
  "A few clouds": "Ein paar Wolken",
  "How far one sees": "Sichtweite",

  // the touch controls' layout
  "Drag the controls where you want them":
    "Zieh die Bedienelemente dorthin, wo du sie willst",
  Reset: "Zurücksetzen",
  "Steer left": "Links lenken",
  "Steer right": "Rechts lenken",
  Accelerate: "Gas",
  Brake: "Bremse",
  Handbrake: "Handbremse",
  Arrow: "Pfeil",
  "{control}: move with the arrow keys":
    "{control}: mit den Pfeiltasten verschieben",

  // the replay's way out
  "Exit the replay": "Replay verlassen",
  "Exit (Esc)": "Verlassen (Esc)",
  Exit: "Verlassen",

  // multiplayer
  Room: "Raum",
  "Room {room}": "Raum {room}",
  "Public rooms": "Öffentliche Räume",
  "Rooms their hosts made public. Up to eight race in one.":
    "Räume, die ihre Hosts öffentlich gemacht haben. Bis zu acht fahren in einem.",
  Host: "Hosten",
  "Open a room of your own, choose the race and invite friends with its code or link, or make it public.":
    "Öffne einen eigenen Raum, wähl das Rennen und lade Freunde mit Code oder Link ein, oder mach ihn öffentlich.",
  "Host a race": "Rennen hosten",
  "Join with a code": "Mit Code beitreten",
  "Code of the host's room": "Code vom Raum des Hosts",
  "Join the race": "Beitreten",
  Players: "Spieler",
  "Add a bot": "Bot hinzufügen",
  "The race": "Das Rennen",
  "Link for your guests": "Link für deine Gäste",
  Copy: "Kopieren",
  Copied: "Kopiert",
  "Who can join": "Wer beitreten kann",
  "With the code or link": "Mit Code oder Link",
  "Everyone: a public room": "Alle: ein öffentlicher Raum",
  "A public room is listed for everyone, with your name and the race.":
    "Ein öffentlicher Raum ist für alle gelistet, mit deinem Namen und dem Rennen.",
  Mode: "Modus",
  "Bot strength": "Bot-Stärke",
  Time: "Zeit",
  "Back after": "Zurück nach",
  "Team mates crash": "Teamkollegen kollidieren",
  Yes: "Ja",
  "No, pass through": "Nein, durchfahren",
  You: "Du",
  "Your car": "Dein Auto",
  "Your paint": "Deine Lackierung",
  "Your team": "Dein Team",
  Ready: "Bereit",
  "Ready!": "Bereit!",
  "Watch the race": "Rennen zuschauen",
  "Start the race": "Rennen starten",
  "Leave the room": "Raum verlassen",
  Message: "Nachricht",
  Send: "Senden",
  // the editor's pieces (|piece: as a piece's name) and what it says of the stage
  "Road|piece": "Straße",
  "Turn|piece": "Kurve",
  "Night road|piece": "Nachtstraße",
  "Night turn|piece": "Nachtkurve",
  "Fence road|piece": "Straße mit Zaun",
  "Road blend|piece": "Straßenübergang",
  "Road end|piece": "Straßenende",
  "Offroad|piece": "Gelände",
  "Bumpy|piece": "Holprig",
  "Road to offroad|piece": "Straße zu Gelände",
  "Night to offroad|piece": "Nacht zu Gelände",
  "End|piece": "Ende",
  "Side|piece": "Rand",
  "Bumpy side|piece": "Holpriger Rand",
  "Halfpipe ground|piece": "Halfpipe-Boden",
  "Ramps|piece": "Rampen",
  "Ramp|piece": "Rampe",
  "Curved ramp|piece": "Gebogene Rampe",
  "Small ramp|piece": "Kleine Rampe",
  "Double ramp|piece": "Doppelrampe",
  "Hill|piece": "Hügel",
  "Slide|piece": "Rutsche",
  "Takeoff|piece": "Absprung",
  "Takeoff 2|piece": "Absprung 2",
  "Uprise|piece": "Anstieg",
  "Rise road|piece": "Steigende Straße",
  "Speed ramp|piece": "Speedrampe",
  "Offroad bump|piece": "Geländebuckel",
  "Offroad ramp|piece": "Geländerampe",
  "Small offroad ramp|piece": "Kleine Geländerampe",
  "Offroad hill|piece": "Geländehügel",
  "Uphill|piece": "Bergauf",
  "Checkpoint|piece": "Checkpoint",
  "Offroad checkpoint|piece": "Gelände-Checkpoint",
  "Air checkpoint|piece": "Luft-Checkpoint",
  "Fix hoop|piece": "Reparaturring",
  "Obstacles|piece": "Hindernisse",
  "Spikes|piece": "Stacheln",
  "Rail|piece": "Geländer",
  "Side wall|piece": "Seitenwand",
  "Slider|piece": "Schieber",
  "Rocks|piece": "Felsen",
  "Rocks 2|piece": "Felsen 2",
  "Net|piece": "Netz",
  "Scenery|piece": "Kulisse",
  "Tree 1|piece": "Baum 1",
  "Tree 2|piece": "Baum 2",
  "Tree 3|piece": "Baum 3",
  "Tree 4|piece": "Baum 4",
  "Tree 5|piece": "Baum 5",
  "Tree 6|piece": "Baum 6",
  "Tree 7|piece": "Baum 7",
  "Tree 8|piece": "Baum 8",
  "Cactus 1|piece": "Kaktus 1",
  "Cactus 2|piece": "Kaktus 2",
  "Cactus 3|piece": "Kaktus 3",
  "Not on the path": "Nicht auf dem Pfad",
  "Path point": "Pfadpunkt",
  "Corner the AI may cut": "Kurve, die die KI schneiden darf",
  "Ramp the AI drives straight at": "Rampe, auf die die KI gerade zufährt",
  "Path point the AI may leave out": "Pfadpunkt, den die KI auslassen darf",
  "Halfpipe the AI drives back over": "Halfpipe, über die die KI zurückfährt",
  "No road under the start grid in the middle of the map.":
    "Keine Straße unter dem Startfeld in der Mitte der Karte.",
  "The path should begin on a start piece.":
    "Der Pfad sollte auf einem Startteil beginnen.",
  "A lap needs at least one checkpoint.":
    "Eine Runde braucht mindestens einen Checkpoint.",
  "The path needs at least three points to go round.":
    "Der Pfad braucht mindestens drei Punkte für eine Runde.",
  "3D view: W A S D to fly, Q and E down and up, Shift faster, drag to look round, scroll forward and back. V for the map.":
    "3D-Ansicht: W A S D zum Fliegen, Q und E runter und hoch, Shift schneller, ziehen zum Umsehen, scrollen für vor und zurück. V für die Karte.",
  "Ordering the path: click the pieces in the order the cars drive them, the start first. Escape to stop.":
    "Pfad ordnen: Klick die Teile in der Reihenfolge an, in der die Autos sie fahren, den Start zuerst. Escape zum Beenden.",
  "Placing {piece}: click to place, R to turn, Escape to stop.":
    "{piece} setzen: klicken zum Setzen, R zum Drehen, Escape zum Beenden.",
  "{piece} selected: drag or arrow keys to move, R to turn, D for another, Del to take away, , and . along the path.":
    "{piece} gewählt: ziehen oder Pfeiltasten zum Verschieben, R zum Drehen, D für noch eins, Entf zum Entfernen, , und . entlang des Pfads.",
  "1 piece. Pick a piece on the left, drag the map to look around, scroll to zoom. ? for the keys and how the path works.":
    "1 Teil. Wähl links ein Teil, zieh die Karte zum Umsehen, scroll zum Zoomen. ? für die Tasten und wie der Pfad funktioniert.",
  "{pieces} pieces. Pick a piece on the left, drag the map to look around, scroll to zoom. ? for the keys and how the path works.":
    "{pieces} Teile. Wähl links ein Teil, zieh die Karte zum Umsehen, scroll zum Zoomen. ? für die Tasten und wie der Pfad funktioniert.",
  "{name} (start)": "{name} (Start)",
  "Earlier:": "Früher:",
  "Later:": "Später:",
  "Nothing selected.": "Nichts gewählt.",
  Height: "Höhe",
  "Off the path (the AI leaves the path for it)":
    "Neben dem Pfad (die KI verlässt den Pfad dafür)",
  "The start of the path, of {points} points.":
    "Der Start des Pfads, von {points} Punkten.",
  "Point {point} of {points} on the path.":
    "Punkt {point} von {points} auf dem Pfad.",
  Earlier: "Früher",
  Later: "Später",
  "Make start": "Zum Start machen",
  "Ready to race.": "Bereit zum Rennen.",
  " (editing)": " (in Bearbeitung)",
  Edit: "Bearbeiten",
  'Delete "{stage}"?': "„{stage}“ löschen?",

  // the lobby and the public rooms
  "The host left the room.": "Der Host hat den Raum verlassen.",
  "The room is full: eight race in it already.":
    "Der Raum ist voll: Es fahren schon acht darin.",
  "Connecting...": "Verbinde...",
  "Waiting for others to join. You can also start a race with bots now.":
    "Warte auf weitere Spieler. Du kannst auch gleich ein Rennen mit Bots starten.",
  "Waiting for everyone to be ready...": "Warte, bis alle bereit sind...",
  "Everyone is ready: start a race when you like.":
    "Alle sind bereit: Starte ein Rennen, wann du willst.",
  "Everyone in the lobby is ready: start a race when you like. The others can join the next one.":
    "Alle in der Lobby sind bereit: Starte ein Rennen, wann du willst. Die anderen können beim nächsten mitfahren.",
  "Waiting for the host...": "Warte auf den Host...",
  "A race is going on: watch it, or wait for the next one.":
    "Gerade läuft ein Rennen: Schau zu oder warte auf das nächste.",
  "You are ready. The race starts when the host starts it.":
    "Du bist bereit. Das Rennen beginnt, wenn der Host es startet.",
  "Choose your car, then say you are ready.":
    "Wähl dein Auto und sag dann, dass du bereit bist.",
  "Player {number}": "Spieler {number}",
  " (host)": " (Host)",
  " (you)": " (du)",
  "In a race": "Im Rennen",
  "Watching the highlight": "Schaut das Highlight",
  "Watching the replay": "Schaut das Replay",
  "At the results": "Bei den Ergebnissen",
  Away: "Weg",
  "Not ready": "Nicht bereit",
  "Same network": "Gleiches Netzwerk",
  "not chosen yet": "noch nicht gewählt",
  None: "Keine",
  "{teams} teams": "{teams} Teams",
  "Voice chat is off. Switch it on in the options to talk with the others.":
    "Der Sprachchat ist aus. Schalte ihn in den Optionen ein, um mit den anderen zu reden.",
  "The others hear you whenever you speak.":
    "Die anderen hören dich, sobald du sprichst.",
  "Hold to talk, or tap to talk until you tap again. In a race hold P.":
    "Halten zum Sprechen, oder tippen und sprechen, bis du wieder tippst. Im Rennen P halten.",
  "Asking the host...": "Frage den Host...",
  Someone: "Jemand",
  "Any team": "Beliebiges Team",
  Remove: "Entfernen",
  "Paint of {bot}": "Lackierung von {bot}",
  "Team of {bot}": "Team von {bot}",
  "Remove {bot}": "{bot} entfernen",
  "{name}'s room": "Raum von {name}",
  "A room": "Ein Raum",
  "{players} of {most} players": "{players} von {most} Spielern",
  "1 bot": "1 Bot",
  "{bots} bots": "{bots} Bots",
  " and ": " und ",
  Full: "Voll",
  Join: "Beitreten",
  "{room} is full": "{room} ist voll",
  "Join {room}": "{room} beitreten",
  "{mode} on {stage}": "{mode} auf {stage}",
  "Racing now": "Fährt gerade",
  "The public rooms could not be loaded. You can still join with a code.":
    "Die öffentlichen Räume ließen sich nicht laden. Mit einem Code kannst du trotzdem beitreten.",
  "Looking for public rooms...": "Suche öffentliche Räume...",
  "No public rooms right now: host one, or join with a code.":
    "Gerade keine öffentlichen Räume: Hoste einen oder tritt mit einem Code bei.",
  "Enter the code the host sees: letters, digits and dashes.":
    "Gib den Code ein, den der Host sieht: Buchstaben, Ziffern und Bindestriche.",
  "Normal race": "Normales Rennen",
  "Only racing": "Nur Rennen",
  "Last survivor": "Letzter Überlebender",
  "Time attack": "Zeitfahren",
  "Most kills": "Meiste Kills",
  Easy: "Leicht",
  Hard: "Schwer",
  Red: "Rot",
  Blue: "Blau",
  Green: "Grün",
  Yellow: "Gelb",
  Purple: "Lila",
  Black: "Schwarz",
  White: "Weiß",
  Lime: "Hellgrün",
  Grey: "Grau",
  Maroon: "Weinrot",
  Teal: "Petrol",
  "Dark green": "Dunkelgrün",
  Navy: "Marineblau",
  "Sky blue": "Himmelblau",
  // (a paint said within a line: "Radical One in red")
  red: "Rot",
  orange: "Orange",
  yellow: "Gelb",
  green: "Grün",
  blue: "Blau",
  purple: "Lila",
  black: "Schwarz",
  white: "Weiß",
  pink: "Pink",
  lime: "Hellgrün",
  cyan: "Cyan",
  grey: "Grau",
  maroon: "Weinrot",
  teal: "Petrol",
  "dark green": "Dunkelgrün",
  navy: "Marineblau",
  "sky blue": "Himmelblau",
  Own: "Eigene",

  // a race together
  "Out of sync!": "Nicht mehr synchron!",
  "The host left the race": "Der Host hat das Rennen verlassen",
  "Player {number} left the race": "Spieler {number} hat das Rennen verlassen",
  "Waiting for player {number}...": "Warte auf Spieler {number}...",

  // the race's HUD and messages
  "SWITCHING CARS": "AUTOWECHSEL",
  "Laps Reset, Time +10": "Runden zurück, Zeit +10",
  "Reversing Time": "Zeit läuft zurück",
  Alright: "Okay",
  Nice: "Schön",
  Wicked: "Krass",
  Amazing: "Wahnsinn",
  Awesome: "Hammer",
  Ripping: "Irre",
  Radical: "Radikal",
  "What the...?": "Was zum...?",
  "You're a super star!!!!": "Du bist ein Superstar!!!!",
  "Who are you again...?": "Wer bist du noch mal...?",
  "surf style": "Surf-Style",
  "You Won!": "Gewonnen!",
  "You Lost!": "Verloren!",
  "Finished!": "Im Ziel!",
  "{place} in {time}, the others still racing":
    "{place} in {time}, die anderen fahren noch",
  Damage: "Schaden",
  Wasted: "Schrott",
  "Your Team Won!": "Dein Team gewinnt!",
  "You're Wasted!": "Du bist geschrottet!",
  "Back in {time}": "Zurück in {time}",
  "Every car has been wasted!": "Alle Autos sind geschrottet!",
  "Team {team} wins!": "Team {team} gewinnt!",
  "You Wasted'em!": "Alle geschrottet!",
  "You Won, all cars have been wasted!":
    "Gewonnen, alle Autos sind geschrottet!",
  "{car} is the last survivor!": "{car} überlebt als Letzter!",
  "You finished first, nice job!": "Du bist Erster, gut gemacht!",
  "{car} finished first, race over!": "{car} ist Erster, Rennen vorbei!",
  Behind: "Hinten",
  Track: "Strecke",
  Free: "Frei",
  Camera: "Kamera",
  "Target: none": "Ziel: keins",
  "Target: {car}": "Ziel: {car}",
  none: "keins",
  "Free camera": "Freie Kamera",
  "Watching {car}": "Zuschauen: {car}",
  "W A S D Q E to fly, drag to look · V camera · Esc menu":
    "W A S D Q E zum Fliegen, ziehen zum Umsehen · V Kamera · Esc Menü",
  "Steer for another car · V camera · Esc menu":
    "Lenken für ein anderes Auto · V Kamera · Esc Menü",
  "Race over": "Rennen vorbei",
  "Continue ": "Weiter ",
  "Watch Race": "Zuschauen",
  "Watch Replay": "Replay",
  "Lap {lap}/{laps}   {time}": "Runde {lap}/{laps}   {time}",
  "   Best lap {time}": "   Beste Runde {time}",
  "Your time: {time}": "Deine Zeit: {time}",
  "{time}, a new best!": "{time}, neue Bestzeit!",
  "{time}, best {best}": "{time}, Bestzeit {best}",
  ", but a new best lap!": ", aber neue beste Runde!",
  " Arrow now pointing at >  CARS": " Pfeil zeigt jetzt auf >  AUTOS",
  " Arrow now pointing at >  TRACK": " Pfeil zeigt jetzt auf >  STRECKE",
  "Check Point Missed!": "Checkpoint verpasst!",
  "Wrong Way!": "Falsche Richtung!",
  Lap: "Runde",
  Place: "Platz",
  // (1st, 2nd: 1., 2.)
  st: ".",
  nd: ".",
  rd: ".",
  th: ".",
  "Go!": "Los!",
  "Power low, perform stunt!": "Wenig Power, mach einen Stunt!",
  "Try to flip your car in the air to preform stunts!":
    "Dreh dein Auto in der Luft, um Stunts zu machen!",
  "Bad Landing!": "Schlechte Landung!",
  "Forward loop": "Vorwärtsloop",
  "double Forward": "doppelt vorwärts",
  "triple Forward": "dreifach vorwärts",
  Backloop: "Rückwärtsloop",
  "double Back": "doppelt rückwärts",
  "triple Back": "dreifach rückwärts",
  "double Rollspin": "doppelter Rollspin",
  "triple Rollspin": "dreifacher Rollspin",
  "massive Forward looping": "gewaltiger Vorwärtsloop",
  "massive Back looping": "gewaltiger Rückwärtsloop",
  "Tabletop and reversed Tabletop": "Tabletop und umgekehrter Tabletop",
  "Hanged ": "Hängender ",
  "massive Roll spinning": "gewaltige Rollspins",
  " with ": " mit ",
  " by ": " um ",
  " and beyond": " und mehr",
  "POWER TO THE MAX": "POWER AUF MAXIMUM",
  "Car Fixed": "Auto repariert",
  "{car} has been wasted!": "{car} wurde geschrottet!",
  "Check Point": "Checkpoint",
  "Best Stunt!": "Bester Stunt!",
  "Wasted!": "Geschrottet!",
  "Close Finish!": "Knappes Finish!",
  "Close Finish!  Almost got it!": "Knappes Finish!  Fast geschafft!",
  "Game Highlight": "Spiel-Highlight",
  "You have been wasted": "Du wurdest geschrottet",
  "{car} has been wasted": "{car} wurde geschrottet",
  "You wasted {car}": "Du hast {car} geschrottet",
  "{car} wasted you": "{car} hat dich geschrottet",
  "{by} wasted {car}": "{by} hat {car} geschrottet",
  "Other cars' sounds: on": "Geräusche der anderen: an",
  "Other cars' sounds: off": "Geräusche der anderen: aus",
  "Minimap: on": "Minikarte: an",
  "Minimap: off": "Minikarte: aus",
  "Target camera: on": "Zielkamera: an",
  "Target camera: off": "Zielkamera: aus",
  "Classic menus and HUD: on": "Klassische Menüs und HUD: an",
  "Classic menus and HUD: off": "Klassische Menüs und HUD: aus",
  "SWITCH MODE": "SWITCH-MODUS",
  "1 Lap, No Fixing": "1 Runde, keine Reparatur",
  "Handbrake / Stunts": "Handbremse / Stunts",
  "Drive / Stunts": "Fahren / Stunts",
  "Or [W] [A] [S] [D]": "Oder [W] [A] [S] [D]",

  // the pause menu
  "Resume Game ": "Weiterspielen ",
  "Instant Replay": "Sofort-Replay",
  "Game Instructions": "Spielanleitung",
  "x Quit Game": "x Beenden",
  "x Leave Race": "x Verlassen",
  "Not enough gameplay was recorded yet!":
    "Es wurde noch nicht genug aufgezeichnet!",

  // the replay
  Play: "Abspielen",
  Space: "Leertaste",
  Slower: "Langsamer",
  Faster: "Schneller",
  Cars: "Autos",
  Save: "Speichern",
  "Ctrl+S": "Strg+S",
  " (You)": " (Du)",
  "← →: a step (hold: wind)     Home / End: start / end     ":
    "← →: ein Schritt (halten: spulen)     Pos1 / Ende: Anfang / Ende     ",
  "Free camera: W A S D, Q / E, Shift, drag to look":
    "Freie Kamera: W A S D, Q / E, Shift, ziehen zum Umsehen",
  "Z / X: look back": "Z / X: zurückschauen",
  "C / ⇧C: next / previous car": "C / ⇧C: nächstes / voriges Auto",
  "     H: hide": "     H: ausblenden",
  End: "Ende",
  Paused: "Pausiert",
  "Tap a car to follow it.   Tap here for the controls":
    "Tipp ein Auto an, um ihm zu folgen.   Hier tippen für die Steuerung",
  "Click a car to follow it   Tab: hide the cars   H: the controls":
    "Klick ein Auto an, um ihm zu folgen   Tab: Autos ausblenden   H: Steuerung",
  "Tap here for the replay controls": "Hier tippen für die Replay-Steuerung",
  "Press H for the replay controls": "H drücken für die Replay-Steuerung",
  "Tap here to hide the controls": "Hier tippen, um die Steuerung auszublenden",
  "This is not a replay file.": "Das ist keine Replay-Datei.",
  "This replay is from a newer version of the game.":
    "Dieses Replay stammt aus einer neueren Version des Spiels.",
  "This replay file is damaged.": "Diese Replay-Datei ist beschädigt.",

  // the menus drawn: car select, stage select, race end, instructions, loading
  "Select your Car": "Wähle dein Auto",
  " Back": " Zurück",
  " Prev": " Vorher",
  "Next ": "Weiter ",
  "Top Speed": "Topspeed",
  Acceleration: "Beschleunigung",
  Strength: "Stärke",
  Endurance: "Ausdauer",
  "This car unlocks when  stage {stage}  is completed!":
    "Dieses Auto gibt es, wenn  Stage {stage}  geschafft ist!",
  "PLAY ": "LOS ",
  "Practice ": "Training ",
  "Finish ": "Fertig ",
  "Loading {stage}": "Lade {stage}",
  "Loading Stage...": "Lade Stage...",
  "( Guidance arrow is disabled in this stage... )":
    "( Der Leitpfeil ist in dieser Stage aus... )",
  "Final Stage": "Finale Stage",
  "{cars} Cars  [C]": "{cars} Autos  [C]",
  "AI: {strength}  [B]": "KI: {strength}  [B]",
  "Best lap {lap}   Best race {race}":
    "Beste Runde {lap}   Bestes Rennen {race}",
  "No best time yet": "Noch keine Bestzeit",
  "TIP ": "TIPP ",
  "PLAY SWITCH ": "SWITCH ",
  "THIS. IS. MADNESS !": "DAS. IST. WAHNSINN !",
  "Congradulations!": "Glückwunsch!",
  "You won at {stage}": "Gewonnen auf {stage}",
  "You lost at {stage}": "Verloren auf {stage}",
  stage: "Stage",
  "Stage {stage} and {car} is now unlocked!":
    "Stage {stage} und {car} sind jetzt freigeschaltet!",
  "Stage {stage} is now unlocked!": "Stage {stage} ist jetzt freigeschaltet!",
  "Wooohooo you finished the game!": "Juhuuu, du hast das Spiel durchgespielt!",
  "You're Awesome! You're truly a MAD DRIVER!":
    "Du bist großartig! Ein echter MAD DRIVER!",
  "Practice game finished": "Trainingsrennen beendet",
  "Reset your Game": "Setz dein Spiel zurück",
  "Would you like to play the game from the beginning again?":
    "Möchtest du das Spiel noch einmal von vorn spielen?",
  "Note! This will delete all your saved unlocked cars and stages":
    "Achtung! Das löscht alle freigeschalteten Autos und Stages,",
  "and will start the game like it was never played before!":
    "und das Spiel beginnt, als wäre es nie gespielt worden!",
  "Challenge yourself again and reset the game now?":
    "Neue Herausforderung gefällig? Jetzt zurücksetzen?",
  "Yes!  Reset my game now": "Ja!  Jetzt zurücksetzen",
  " Cancel": " Abbrechen",
  "Preform stunts to power up your car!":
    "Mach Stunts, um dein Auto aufzuladen!",
  "It is easier to just waste the other cars in this stage!":
    "Hier ist es leichter, die anderen Autos zu schrotten!",
  "Use the Arrow Target button": "Nimm den Knopf 'Arrow Target'",
  "Welcome to  Need for Madness !": "Willkommen bei  Need for Madness !",
  "In this game there are two ways to complete a stage.":
    "In diesem Spiel gibt es zwei Wege, eine Stage zu schaffen.",
  "One is by racing and finishing in first place, the other is by":
    "Entweder du fährst das Rennen und kommst als Erster ins Ziel,",
  "wasting and crashing all the other cars in the stage!":
    "oder du schrottest und crashst alle anderen Autos der Stage!",
  Wasting: "Schrotten",
  OR: "ODER",
  "Whether you are racing or wasting, you will need to":
    "Ob du Rennen fährst oder Autos schrottest, du musst",
  "power up your car.": "dein Auto aufladen.",
  "The more powered your car is, the stronger and faster":
    "Je mehr Power dein Auto hat, desto stärker und schneller",
  "it becomes! Which is helpful when racing or wasting.":
    "wird es! Das hilft beim Rennen wie beim Schrotten.",
  "To power up your car (and keep it powered up) you will need to":
    "Um dein Auto aufzuladen (und geladen zu halten), musst du",
  "perform stunts!": "Stunts machen!",
  "When wasting cars, to help you find the other cars in the stage,":
    "Damit du beim Schrotten die anderen Autos der Stage findest,",
  "press the 'Arrow Target' button to toggle the guidance arrow":
    "drück den Knopf 'Arrow Target': Der Leitpfeil zeigt dann",
  "from pointing to the track to pointing to the cars.":
    "nicht mehr auf die Strecke, sondern auf die Autos.",
  "When your car is damaged, you can fix it (and reset its 'Damage')":
    "Ist dein Auto beschädigt, reparierst du es (und den 'Schaden'),",
  "by jumping through the electrified hoop.":
    "indem du durch den Elektroring springst.",
  "Drive your car using the keyboard arrows and also use the":
    "Steuere dein Auto mit den Pfeiltasten und nimm",
  "Spacebar, then the arrows, when your car is in the air for stunts.":
    "in der Luft für Stunts die Leertaste und dann die Pfeile.",
  "keyboard arrows when your car is in the air to perform stunts.":
    "die Pfeiltasten auch in der Luft, um Stunts zu machen.",
  "Press Spacebar for Handbrakes to drift while turning and make":
    "Drück die Leertaste für die Handbremse, um in Kurven zu",
  "quick 180 turns.": "driften und schnell um 180° zu wenden.",
  "(Gamepad & Joystick control is also possible.)":
    "(Gamepad- und Joystick-Steuerung geht auch.)",
  "Drive your car using the arrow buttons on the screen.":
    "Fahr dein Auto mit den Pfeilknöpfen am Bildschirm.",
  "In the air press Handbrake, then them, to perform stunts.":
    "Drück in der Luft Handbremse, dann die Pfeile, für Stunts.",
  "Also use them when your car is in the air to perform stunts.":
    "Nimm sie auch in der Luft, um Stunts zu machen.",
  "Press the Handbrake button while turning to drift and make":
    "Drück in Kurven den Handbremse-Knopf, um zu",
  "And finally my name is Coach Insano, and I am here to help you":
    "Und zum Schluss: Ich bin Coach Insano und helfe dir,",
  "and guide you to become the greatest Need for Madness driver":
    "der größte Need-for-Madness-Fahrer zu werden,",
  "you can be!": "der du sein kannst!",
  "I will also offer you hints and tips on the ideal strategy to":
    "Ich gebe dir auch Hinweise und Tipps zur besten Strategie",
  "complete each stage. Good luck!": "für jede Stage. Viel Glück!",
  "Additional Keyboard Controls": "Weitere Tasten",
  "Music Credits": "Musik-Credits",
  "[X] & [Z] to look back while driving.":
    "[X] & [Z] zum Zurückschauen beim Fahren.",
  "[Q] to toggle the guidance arrow by Keyboard.":
    "[Q] schaltet den Leitpfeil per Tastatur um.",
  "[R] to trigger time reversal and rewind time.":
    "[R] lässt die Zeit zurücklaufen.",
  "[W], [A], [S] & [D] can also be used instead of Keyboard arrows.":
    "[W], [A], [S] & [D] gehen auch statt der Pfeiltasten.",
  "[V] for cinematic camera views while driving.":
    "[V] für Kinokameras beim Fahren.",
  "[M] to mute music.": "[M] schaltet die Musik stumm.",
  "[N] to mute sound effects.": "[N] schaltet die Soundeffekte stumm.",
  "[Enter] & [Esc] to navigate and pause game.":
    "[Enter] & [Esc] zum Navigieren und Pausieren.",
  "Interface and Game Menus: Neon Nox - Shift":
    "Oberfläche und Spielmenüs: Neon Nox - Shift",
  "This Game Is Crazy !": "Dieses Spiel ist verrückt !",
  "Sorry, your device does not seem to have WEBGL":
    "Sorry, dein Gerät scheint kein WEBGL zu haben",
  "The game will not be able to work without it":
    "Ohne WEBGL kann das Spiel nicht laufen",
  "Please try the game on another device":
    "Bitte versuch das Spiel auf einem anderen Gerät",
};
