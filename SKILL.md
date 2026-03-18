---
name: germanizer
description: |
  Entfernt KI-typische Schreibmuster in deutschen und englischen Texten.
  Zwei Modi: STANDARD (keine Emojis, maximale Klarheit) und META-ADS
  (Emojis als Strukturmarker nach Regelwerk). Modus wird automatisch
  aus dem Input erschlossen. Trigger für Meta-Ads-Modus: Prefix [META-ADS]
  oder Keywords wie Meta Ads, Facebook Ads, Instagram Ads, Ad Copy,
  Primary Text, Headline, CTA. Trigger für Standard-Modus: jede Bitte
  Text zu humanisieren, KI-Sprache zu entfernen, natürlicher klingen zu
  lassen, oder Germanizer anzuwenden.
---

# Germanizer

## ZIEL
Überarbeite den Input so, dass er wie von einem kompetenten Menschen geschrieben wirkt.
Bedeutung, Fakten, Zahlen, Namen und Zusagen bleiben unverändert.

## OUTPUT
- Nur den überarbeiteten Text ausgeben.
- Kein Vorwort, kein Nachwort, keine Selbstreferenz.
- Formatierung nur wenn bereits vorhanden oder für den Kanal nötig.

---

## SCHRITT 1 - MODUS BESTIMMEN (einmalig, vor allem anderen)

META-ADS MODUS wenn mindestens eines zutrifft:
- Expliziter Prefix im Input: [META-ADS]
- Input enthält: Meta Ads, Facebook Ads, Instagram Ads, Paid Social, Ad Copy, Primary Text, Headline, CTA, Copy für IG/FB, Anzeigentext

STANDARD-MODUS in allen anderen Fällen.

Modus wird einmal festgelegt, danach nicht mehr überprüft.

---

## STANDARD-MODUS

- Emojis vollständig entfernen.
- Übertriebene Deko-Zeichen entfernen.
- Priorität: Klarheit, Natürlichkeit, konkrete Aussagen.
- Persönlichkeit hinzufügen wo sinnvoll: Meinungen, Rhythmuswechsel, Ich-Perspektive wenn passend.

Vollständige Musterliste mit Vorher/Nachher-Beispielen: references/patterns.md
Lade diese Referenz wenn der Text komplex ist oder du unsicher bist welches Muster greift.

---

## META-ADS MODUS

Ziel: Struktur und Scanbarkeit verbessern, ohne Emoji-Chaos.

### Grundregeln
- Emojis nur als Strukturmarker - nie als Fließtext-Deko.
- Pro Liste genau ein Emoji-Typ, durchgängig.
- Pro Zeile maximal ein Emoji am Zeilenanfang.
- Keine Emoji-Ketten.
- Keine naheliegenden Themen-Icons (Häuser, Autos, Flaggen, Essen), außer explizit gewünscht.

### Welches Emoji wo

| Kontext | Emoji |
|---|---|
| Ort | 📍 (fix) |
| Uhrzeit | ⏰ oder 🕒 |
| Datum / Kalender | 📅 |
| CTA-Zeile | 👉 (kein weiteres Emoji in der Zeile) |
| Aufmerksamkeits-Hook (max. 1-2 Zeilen ganz oben) | ✨ ⭐ 🔔 ⚡ |

### Listen - Emoji wählen und durchhalten

Neutral (eines pro Liste):
✅  ☑️  ◻️  ▪️  ◆  ➤  •

Feminin (eines pro Liste):
✨  ⭐  💗  🌸

---

## HARTE REGELN (beide Modi)

- Keine Fakten erfinden, keine Quellen erfinden.
- Keine leeren Übergänge: kein Zusammenfassend, Insgesamt, Abschließend.
- Keine Chatbot-Floskeln: kein Ich hoffe das hilft, Gern, Natürlich.
- Kein FETT für ganze Sätze, keine Bullet-Orgie.
- Keine Bedeutungsinflation ohne Beleg.
- Keine Em-Dashes / Gedankenstriche.

---

## BEARBEITUNGS-PRIORITÄTEN

1. Inhaltstreue
2. Kürze ohne Informationsverlust
3. Satzmelodie: variabel, kein KI-Rhythmus
4. Konkretheit statt Abstraktion
5. Channel-Konformität (STANDARD vs. META-ADS)

---

## QUICK-CHECK

- Klingt es wie ein Mensch, der etwas wirklich meint?
- Würde ein Profi das so schreiben?
- Kürzer, klarer, gleicher Inhalt?
- Im Meta-Ads-Modus: Emojis konsistent, sparsam, regelkonform?
