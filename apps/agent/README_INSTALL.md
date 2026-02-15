# 🤖 Inštalácia AutoDesign Agenta (macOS)

Tento návod slúži na sprevádzkovanie lokálneho agenta, ktorý prepája tlačiareň a Photoshop s PWA aplikáciou.

## 1. Príprava (Jednorazová)
Keďže ide o interný softvér, macOS ho môže blokovať ako "Neznámeho vývojára". Musíme povoliť jeho spustenie.

1. Otvorte priečinok `apps/agent` v Finderi.
2. Nájdite súbor **`install-agent.command`**.
3. **Kliknite naň pravým tlačidlom** a vyberte **Otvoriť** (Open).
   - Ak sa zobrazí okno s varovaním, kliknite na **Otvoriť** (Open) ešte raz.
4. Spustí sa terminál, ktorý:
   - Odblokuje súbory pre tento Mac (odstráni karanténu).
   - Nainštaluje potrebné knižnice (Node modules).

✅ **Ak uvidíte "Inštalácia úspešná!", môžete okno zatvoriť.**

---

## 2. Spustenie Agenta
Pre bežnú prácu stačí spustiť agenta:

1. Dvakrát kliknite na **`start.command`**.
2. Otvorí sa terminálové okno, ktoré musí **ostať otvorené**, kým pracujete.
3. V okne by ste mali vidieť:
   - `✅ Connected to Server`
   - `🤖 Agent Online`

---

## 3. Riešenie problémov

### "Súbor je poškodený" alebo "Nemožno otvoriť"
Ak macOS stále odmieta spustiť skript:
1. Otvorte Terminál (Cmd+Space -> Terminal).
2. Napíšte `chmod +x ` (s medzerou na konci).
3. Potiahnite súbor `install-agent.command` do okna terminálu.
4. Stlačte Enter.
5. Skúste znova bod 1.

### Chýbajúci Node.js
Agent vyžaduje Node.js. Ak inštalácia zlyhá na chybe `command not found: node`:
1. Stiahnite a nainštalujte Node.js (verzia 18 alebo 20) z [nodejs.org](https://nodejs.org/).
2. Reštartujte počítač a skúste znova bod 1.
