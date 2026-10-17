# Benzin Bitmeden

Basit, hızlı ve eğlenceli bir birinci şahıs zombi hayatta kalma oyunu. Grafikler Three.js ile kutu tarzında.

Gece, deposu boş bir arabanın yanında doğuyorsun. Elinde sadece **fener** ve **levye** var. Haritadaki **5 benzin bidonunu** bul, arabaya dök ve kaç! Zombiler yeşil ve kafaları dikdörtgen. Silahlı zombileri öldürüp silahlarını alabilirsin. Variller, TNT ve C4 ile hepsini havaya uçurabilirsin.

## Çalıştırma

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/ klasörüne yayınlanabilir sürüm
npm test         # birim testleri (vitest)
```

## Kontroller

| Eylem | Klavye / Fare | Oyun kolu (Xbox / PlayStation) |
|---|---|---|
| Hareket | W A S D | Sol çubuk |
| Bakış | Fare | Sağ çubuk |
| Koşu | Shift | L3 (sol çubuğa bas) |
| Zıplama | Space | A / ✕ |
| Ateş / kullan | Sol tık | RT / R2 |
| Nişan (yakınlaştırma + nişan yardımı) | — | LT / L2 |
| Al / etkileşim | E | X / □ |
| Şarjör | R | B / ○ |
| Fener | F | Y / △ |
| Eşya seç | 1–8, tekerlek, Q | RB / LB |
| C4 patlat | Sağ tık, G | D-pad ▲ |
| Duraklat | Esc, P | Start / Options |

- Oyun kolu tarayıcının Gamepad API'si ile çalışır. Kolu bağlayıp herhangi bir tuşa basman yeterli.
- Menüler de kolla gezilebilir.
- Ekrandaki tuş ipuçları son kullandığın cihaza göre değişir.
- Ayarlardan şunlar değiştirilebilir: fare ve kol hassasiyeti, Y eksenini ters çevirme, titreşim, nişan yardımı, ses ve müzik.

## Oyun içeriği

- **Zombiler** (hepsi yeşil, kafaları dikdörtgen):
  - Küçük: hızlı, sürü halinde gelir
  - Normal
  - Büyük: yavaş, dayanıklı, oyuncuyu geri iter
  - Silahlı: tabanca, pompalı, makineli veya roketatar kullanır. Ölünce silahını ve biraz mermi düşürür
  - Zırhlı: kask ve yelek takar
  - Patlayan: kafasından vurulursa yerinde patlar. Gövdesinden öldürülürse kafası düşer, alıp fırlatabilirsin
- **Silahlar:** Levye, tabanca, pompalı, makineli, roketatar
- **Patlayıcılar:**
  - Bomba
  - TNT (3 saniyelik fitil)
  - C4 (uzaktan patlatılır)
  - Kırmızı variller (birbirini zincirleme patlatır)
  - Zombi kafası
- **Eşyalar:**
  - Mermi kutusu, zırh, ilk yardım çantası
  - Levyeyle kırılan sandıklardan rastgele eşya çıkar
- **Gece-gündüz döngüsü:** Bir tam döngü yaklaşık 6 dakika. Gece:
  - Ekran kararır, sadece fener ve patlamalar aydınlatır
  - Zombiler iki kat sık gelir ve fenerin ışığına yönelir
- **Pusula:** Ekranın üstünde arabanın ve benzin bidonlarının yönü ile uzaklığı gösterilir.
- **Ses:** Tüm sesler ve müzik WebAudio ile kodda üretilir, ses dosyası kullanılmaz.

## Kod yapısı

```
src/core/      Oyun döngüsü (Game), girdi (klavye/fare + kol), çarpışma, hasar kuralları, ayarlar
src/world/     Harita, kutu modeller, gece-gündüz
src/player/    Birinci şahıs oyuncu, envanter
src/weapons/   Silah tablosu (weaponData), ateş/levye/fırlatma, elde tutulan silah görünümü
src/entities/  Zombiler (tür tablosu + yapay zeka), doğurucu, yerdeki eşyalar, patlayıcılar
src/fx/        Parçacıklar, mermi izleri, yer lekeleri
src/audio/     Kodla üretilen ses efektleri ve müzik
src/ui/        HUD ve menüler
tests/         Hasar, envanter, kol eşlemesi, çarpışma testleri
```

Yeni bir zombi türü eklemek için `src/entities/zombieTypes.js`, yeni bir silah eklemek için `src/weapons/weaponData.js` tablosuna bir satır eklemek yeterli.
