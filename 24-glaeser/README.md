# 24 Gläser

Ein 70-Sekunden-Kurzfilm im Hochformat (1080 x 1920, 30 fps) über das Paradox of Choice. Es gibt kein Filmmaterial, keine Bilddateien und keine Samples. Jedes Bild und jeder Ton entsteht aus Code.

Der fertige Film liegt als `24-glaeser.mp4` im Ordner.

## Inhalt

1. Tag 1: Ein Probierstand mit 24 Sorten Marmelade. 60 % bleiben stehen, 3 % davon kaufen.
2. Zurückspulen.
3. Tag 2: derselbe Stand mit 6 Sorten. 40 % bleiben stehen, 30 % davon kaufen.
4. Die Meta-Analyse von 2010 findet im Schnitt praktisch keinen Effekt (schematische Darstellung).
5. Die Meta-Analyse von 2015 nennt vier Bedingungen, unter denen zu viel Auswahl lähmt.
6. Finale mit zwei Gläsern.

Quellen: Iyengar & Lepper (2000), Scheibehenne, Greifeneder & Todd (2010), Chernev, Böckenholt & Goodman (2015).

## Aufbau

| Datei | Aufgabe |
|---|---|
| `timeline.js` | Gemeinsame Zeitleiste im Takt (96 BPM, 28 Takte). Bild und Ton lesen dieselben Zeitpunkte. |
| `film.html` | Canvas-Renderer. Jedes Bild ist eine reine Funktion der Zeit: `renderAt(t)`. |
| `audio.mjs` | Synthesizer in Node: Glockenspiel, Marimba, Karplus-Strong-Bass, Flächen, Drums, Freeverb, Geräusche. Schreibt `out/audio.wav`. |
| `render.mjs` | Startet headless Chromium, rendert Bild für Bild parallel und encodiert mit ffmpeg. |
| `fonts/` | Fraunces, Inter und Caveat (SIL Open Font License). |

Einige Details:

- Linien "kochen" mit 12 Bildern pro Sekunde wie bei Trickfilm auf Papier. Die Figur blinzelt, atmet, und ihr Bommel schwingt der Bewegung nach.
- Beim Zurückspulen läuft die Szene über dieselbe Zeitkurve rückwärts wie der Ton. Der Ton wird dafür aus dem fertigen Mix rückwärts und beschleunigt gelesen.
- Die Tropfen im Punktdiagramm klingen je nach Position höher oder tiefer und sind entsprechend im Stereobild verteilt.
- Das Motiv für "zwei" ist eine Quarte aufwärts (C zu F). Es erklingt, wenn die zwei Gläser erscheinen, und noch einmal im Abspann.

## Selbst rendern

Voraussetzungen: Node 22, Playwright mit Chromium und ffmpeg mit libx264 (zum Beispiel über `pip install imageio-ffmpeg`).

```
node audio.mjs
node render.mjs --video --workers 4
node render.mjs --stills 5,15,40   # einzelne Frames und Kontaktbogen
```

Zum Ansehen im Browser reicht ein lokaler Server im Ordner, zum Beispiel `npx serve .`, danach `film.html` öffnen. Mit `film.html?t=16.3` wird ein einzelner Frame angezeigt.
