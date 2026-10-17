# ZONDI

Basit, hızlı ve eğlenceli bir birinci şahıs zombi hayatta kalma oyunu. Grafikler Three.js ile kutu tarzında.

Gece, deposu boş bir arabanın yanında doğuyorsun. Elinde sadece **fener** ve **levye** var. Haritadaki **5 benzin bidonunu** bul, arabaya dök ve kaç! İstersen yolda bulduğun cipe, tanka, helikoptere ya da uçağa binip zombileri ez veya havadan bombala. Zombiler yeşil ve kafaları dikdörtgen. Silahlı zombileri öldürüp silahlarını alabilirsin. Variller, TNT ve C4 ile hepsini havaya uçurabilirsin.

## Bölümler

1. **Benzin Bitmeden:** Deposu boş arabanın yanında fener ve levyeyle başlarsın. 5 benzin bidonunu bul, arabaya dök ve kaç.
2. **Okuldaki Çocuk:** 1. bölüm bitince başlar. Gecedir, benzini dolu mavi arabanın içindesin ve eşyaların seninle.
   - Telsizden Deniz adında bir çocuğun yardım çağrısı gelir. Köyün güneyindeki okulda saklanıyor; okulun kapısı tahtalarla çakılı ve çevresi zombi dolu.
   - Tahtaları levyeyle (3 darbe) ya da silah/patlayıcıyla kır. İçeride Deniz'e **E / X** ile "Benimle gel!" de.
   - Deniz seni takip eder. Zombiler ona da saldırır, ölürse bölüm biter. Araca binince o da biner (uçak hariç).
   - Yeşil dumanı takip ederek onu kuzey barikatındaki **güvenli bölgeye** götür. Kamptaki nöbetçi taretler yaklaşan zombileri vurur.

İlerleme tarayıcıda kaydedilir. Ana menüdeki **"DEVAM ET: 2. BÖLÜM"** ile 2. bölüme, 1. bölümün sonundaki eşyalarla geri dönebilirsin.

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
| Nişan (yakınlaştırma, daha isabetli) | Sağ tık (basılı tut) | LT / L2 (nişan yardımıyla) |
| Al / etkileşim | E | X / □ |
| Şarjör | R | B / ○ |
| Fener | F | Y / △ |
| Eşya seç | 1–8, tekerlek, Q | RB / LB |
| C4 patlat | G (C4 eldeyken sağ tık) | D-pad ▲ |
| Duraklat | Esc, P | Start / Options |

### Araçlar

Binmek ve inmek için E tuşu (kolda X / □) kullanılır. Araçtayken kamera arkadan takip eder.

| Araç | Klavye / Fare | Oyun kolu |
|---|---|---|
| Kara aracı (motosiklet, cip, pikap, tank) | W/S gaz-geri, A/D direksiyon, Space el freni | RT gaz, LT fren/geri, sol çubuk |
| Tank topu | Sol tık (fareyle nişan) | RB (sağ çubukla nişan) |
| Helikopter | W/S ileri-geri, A/D dönüş, Space yüksel, C alçal, sol tık makineli, sağ tık bomba | Sol çubuk, RT yüksel, LT alçal, RB makineli, LB bomba |
| Uçak | W/S gaz, fare ile yönlendirme, sol tık bomba | RT/LT gaz, sol çubuk, RB bomba |

- Oyun kolu tarayıcının Gamepad API'si ile çalışır. Kolu bağlayıp herhangi bir tuşa basman yeterli.
- Menüler de kolla gezilebilir.
- Ekrandaki tuş ipuçları son kullandığın cihaza göre değişir.
- Ayarlardan şunlar değiştirilebilir: fare ve kol hassasiyeti, Y eksenini ters çevirme, titreşim, nişan yardımı, ses ve müzik.
- Touchpad kullanıyorsan ayarlardan **"Nişan: sağ tıkla aç/kapa"** seçeneğini aç. Böylece sağ tık bir kez basınca nişan açılır, tekrar basınca kapanır; basılı tutman gerekmez.

## Oyun içeriği

- **Zombiler** (hepsi yeşil, kafaları dikdörtgen):
  - Küçük: hızlı, sürü halinde gelir
  - Normal
  - Büyük: yavaş, dayanıklı, oyuncuyu geri iter
  - Silahlı: tabanca, pompalı, makineli veya roketatar kullanır. Ölünce silahını ve biraz mermi düşürür
  - Zırhlı: kask ve yelek takar
  - Patlayan: kafasından vurulursa yerinde patlar. Gövdesinden öldürülürse kafası düşer, alıp fırlatabilirsin
- **Vuruş kuralı** (tabanca, levye ve makinelide bir mermi ya da darbe = 1 vuruş):

  | Zombi | Gövde | Kafa |
  |---|---|---|
  | Küçük | 1 | 1 |
  | Normal, silahlı, patlayan | 2 | 1 |
  | Büyük | 3 | 2 |
  | Zırhlı, asker | 3 | 2 |

  Zırhlı ve askerlerde kask ilk kafa vuruşunu, yelek ilk gövde vuruşunu yutar. Pompalı yakından tek atışta normal zombiyi öldürür.
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
- **Harita** (~450×450 m):
  - Başlangıç bölgesi: araba, benzinlik, çiftlik, evler
  - Batıda köy
  - Kuzeyde yol barikatı
  - Terk edilmiş askeri üs: duvarlar, gözetleme kuleleri, koğuşlar, hangar, helikopter pisti, yakıt deposu
  - Uçak pisti
  - Askeri üste asker zombiler ve iyi eşya çıkan yeşil askeri sandıklar var
- **Araçlar:**
  - Motosiklet, askeri cip, pikap, tank, helikopter, uçak
  - Hızlı giden araç zombileri ezer, sandıkları parçalar, varillere çarpınca patlatır
  - Yakıt sınırlı. Benzinlik pompasında ya da askeri üsteki yakıt deposunda durunca dolar
  - Zombiler araca saldırır. Canı biten araç patlar
  - Benzin bidonları sadece kaçış arabası içindir
- **Siper:** Duvarın arkasındayken zombiler vuramaz, mermiler duvarı delmez, patlamalar çok az hasar verir.
- **Gece-gündüz döngüsü:** Bir tam döngü yaklaşık 6 dakika. Gece:
  - Ekran kararır, sadece fener ve patlamalar aydınlatır
  - Zombiler iki kat sık gelir ve fenerin ışığına yönelir
- **Pusula:** Ekranın üstünde arabanın ve benzin bidonlarının yönü ile uzaklığı gösterilir.
- **Ses:** Tüm sesler ve müzik WebAudio ile kodda üretilir, ses dosyası kullanılmaz.
  - Zombiler yaklaştıkça daha sık inler, seni fark edince kükrer.
  - Her aracın motor sesi farklıdır.

## Kod yapısı

```
src/core/      Oyun döngüsü (Game), girdi (klavye/fare + kol), çarpışma, hasar kuralları, ayarlar
src/world/     Harita, bölgeler (köy, barikat, askeri üs, pist), kutu modeller, gece-gündüz
src/player/    Birinci şahıs oyuncu, envanter
src/weapons/   Silah tablosu (weaponData), ateş/levye/fırlatma, elde tutulan silah görünümü
src/entities/  Zombiler (tür tablosu + yapay zeka), doğurucu, yerdeki eşyalar, patlayıcılar
src/vehicles/  Araç tablosu, saf araç fiziği (test edilir), araç modelleri, sürüş/ezme/kamera
src/fx/        Parçacıklar, mermi izleri, yer lekeleri
src/audio/     Kodla üretilen ses efektleri ve müzik
src/ui/        HUD, menüler, telsiz
src/levels/    2. bölüm görevi (kurtarma)
tests/         Hasar, envanter, kol eşlemesi, çarpışma ızgarası, araç fiziği testleri
```

Yeni bir zombi türü için `src/entities/zombieTypes.js`, yeni bir silah için `src/weapons/weaponData.js`, yeni bir araç için `src/vehicles/vehicleTypes.js` tablosuna bir satır eklemek yeterli.
