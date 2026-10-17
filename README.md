# ZONDI

Basit, hızlı ve eğlenceli bir birinci şahıs zombi hayatta kalma oyunu. Grafikler Three.js ile kutu tarzında.

Gece, deposu boş bir arabanın yanında doğuyorsun. Elinde sadece **fener** ve **levye** var. Haritadaki 5 benzin bidonundan **3'ünü** bul, arabaya dök ve kaç! İstersen yolda bulduğun cipe, tanka, helikoptere ya da uçağa binip zombileri ez veya havadan bombala. Zombiler yeşil ve kafaları dikdörtgen. Silahlı zombileri öldürüp silahlarını alabilirsin. Variller, TNT ve C4 ile hepsini havaya uçurabilirsin.

## Bölümler

1. **Benzin Bitmeden:** Deposu boş arabanın yanında fener ve levyeyle başlarsın. Benzin bidonlarını bul, arabaya dök ve kaç.
2. **Mahsur Çocuklar:** Gece, benzini dolu mavi arabanın içinde başlarsın.
   - Üç çocuk saklanıyor: **Deniz** okulda, **Ela** çiftlik ambarında saman balyalarının arasında, **Can** benzinlik dükkânında. Kapılar tahtayla çakılı.
   - Tahtaları levyeyle (3 darbe) ya da silah/patlayıcıyla kır, çocuğa **E / X** ile "Benimle gel!" de.
   - Çocuklar sırayla seni takip eder ve araca biner. Koltuk sayısı araca göre değişir (sedan/cip/pikap/helikopter 3, tank 2, motosiklet 1, uçak 0).
   - Üçünü de kuzey barikatındaki **güvenli bölgeye** götür. Biri ölürse bölüm biter.
3. **Nükleer Tesis:** Salgın kuzeydoğudaki nükleer tesiste başladı.
   - Lazerli **bilim insanları** ve zehir şişesi atan **kimyagerler** tesisi koruyor.
   - Kontrol odasındaki **Dr. Kaos** kalkanlı: önce iki mor kalkan direğini yık. Canı azalınca zombi çağırır.
   - Dr. Kaos ölünce reaktör kapısı açılır. Bombayı çekirdeğe kur (**E basılı tut**). **90 saniyede** reaktörden 140 m uzaklaş!
4. **Roket ve Uzay İstasyonu:**
   - Güneybatıdaki roket üssünde konsoldan fırlatma sayımını başlat. Zombiler konsola saldırır; **60 saniye** savun.
   - Kuledeki sarı asansörle rokete bin ve fırlatmayı izle.
   - Uzay istasyonunda yerçekimi düşük, pencerede Dünya görünür. Mor **uzaylılar** lazerle ateş eder, uçan **droneler** yaklaşınca patlar.
   - Her bölme temizlenince enerji kapısı açılır. Çekirdek odasındaki **Uzaylı Kraliçe** üç aşamalı: pembe kristaller kalkanını besler.
   - Kraliçe ölünce **DÜNYA KURTARILDI!**

**Kayıt:** Bölüm içinde istediğin yerde **K** (kolda Back / Share) ya da duraklat menüsündeki **KAYDET** ile kaydedebilirsin. Ölürsen **KAYITTAN DEVAM** ile kaydettiğin yerden doğarsın: konumun, eşyaların, zombiler, araçlar, kırdığın kapılar ve kurtardığın çocuklar kayıttaki gibi gelir (can en az 50). Her bölümün başında otomatik kayıt alınır. Bomba geri sayımında, konsol savunmasında ve havadayken kaydedilemez.

İlerleme tarayıcıda kaydedilir. Bölüm sonundaki **"N. BÖLÜME DEVAM"** ya da ana menüdeki **"DEVAM ET"** ile eşyalarınla sonraki bölüme geçersin.

**Bölüm seçimi:** Bölümler sırayla açılır. Ana menüdeki **BÖLÜM SEÇ** ile bitirdiğin bölümleri (ve fırlatmadan sonra uzay istasyonunu) hazır eşyalarla yeniden oynayabilirsin; henüz açılmamış bölümler kilitlidir.

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
| Kaydet | K | Back / View · Share / Create |

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
- **İnsanlar ve uzaylılar** (yeşil değil): bilim insanı (lazer), kimyager (zehir bulutu), Dr. Kaos; uzaylı (lazer), drone (uçar, patlar), Uzaylı Kraliçe
- **Vuruş kuralı** (tabanca, levye ve makinelide bir mermi ya da darbe = 1 vuruş):

  | Zombi | Gövde | Kafa |
  |---|---|---|
  | Küçük | 1 | 1 |
  | Normal, silahlı, patlayan | 2 | 1 |
  | Büyük | 3 | 2 |
  | Zırhlı, asker | 3 | 2 |

  Zırhlı ve askerlerde kask ilk kafa vuruşunu, yelek ilk gövde vuruşunu yutar. Pompalı yakından tek atışta normal zombiyi öldürür.
- **Silahlar:** Levye, tabanca, pompalı, makineli, roketatar, lazer (bilim insanlarından ve uzaylılardan düşer)
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
src/world/     Harita, bölgeler (köy, barikat, askeri üs, pist, nükleer tesis, roket üssü), uzay istasyonu, gece-gündüz
src/player/    Birinci şahıs oyuncu, envanter
src/weapons/   Silah tablosu (weaponData), ateş/levye/fırlatma, elde tutulan silah görünümü
src/entities/  Zombiler (tür tablosu + yapay zeka), doğurucu, yerdeki eşyalar, patlayıcılar
src/vehicles/  Araç tablosu, saf araç fiziği (test edilir), araç modelleri, sürüş/ezme/kamera
src/fx/        Parçacıklar, mermi izleri, yer lekeleri
src/audio/     Kodla üretilen ses efektleri ve müzik
src/ui/        HUD, menüler, telsiz
src/levels/    Bölüm görevleri (kurtarma, reaktör, roket, istasyon) ve saf kuralları, hazır eşyalar
tests/         Hasar, envanter, kol eşlemesi, çarpışma ızgarası, araç fiziği, bölüm kuralları testleri
```

Yeni bir zombi türü için `src/entities/zombieTypes.js`, yeni bir silah için `src/weapons/weaponData.js`, yeni bir araç için `src/vehicles/vehicleTypes.js` tablosuna bir satır eklemek yeterli.
