# Kabel-Seitheben (einarmig)

Animierte Anleitung im Stil klassischer Anatomie-Übungsgrafiken: graue Figur, Zielmuskel rot. Es gibt kein Bildmaterial. Figur, Kabelzug und Bewegung entstehen komplett aus Code (Signed Distance Functions, gerendert per Raymarching).

| Datei | Inhalt |
|---|---|
| `kabel-seitheben.gif` | Nur die Bewegung, 480 x 480, Endlosschleife |
| `kabel-seitheben-mit-hinweisen.gif` | Dieselbe Bewegung mit Phase, Technik-Hinweis und Tempo-Balken |
| `render.py` | Erzeugt beide GIFs |

## Was die Animation zeigt

- Kabelzug steht links von der Person (im Bild rechts), gearbeitet wird mit dem rechten Arm, also dem Arm weiter weg vom Gerät.
- Rolle ganz unten, Einzelgriff. Das Seil läuft vor dem Körper zur Hand.
- Start: Hand vor dem Oberschenkel, Ellenbogen leicht gebeugt, Schulter tief, Rumpf ruhig.
- Hoch in ca. 1 Sekunde, Arm seitlich und leicht nach vorne (Schulterblattebene) wegführen. Der Ellenbogen bleibt gleich gebeugt und führt, die Hand kommt nicht über den Ellenbogen.
- Oben auf Schulterhöhe kurz halten, nicht höher.
- Runter in ca. 2 Sekunden, langsam und kontrolliert.
- Rot markiert ist der Deltamuskel. Sein Ursprung am Schulterdach bleibt fest, der Ansatz wandert mit dem Oberarm. Beim Heben wird er kürzer und dicker.
- Schulter und Rumpf bewegen sich die ganze Zeit nicht: kein Hochziehen zum Ohr, kein Schwung aus dem Oberkörper.

## Selbst rendern

Voraussetzungen: Python 3 mit `numpy`, `numba` und `pillow`.

```
pip install numpy numba pillow
python render.py                      # beide GIFs in diesen Ordner
python render.py --size 360           # kleiner
python render.py --still 0,0.5,1      # Einzelbilder (0 = unten, 1 = oben)
```

Ein Durchlauf dauert auf 4 Kernen etwa eine Minute. Tempo und Pausen stehen in `timeline()`, die Armbahn in `arm_pose()`.
