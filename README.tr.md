<div align="center">

[![English](https://img.shields.io/badge/Language-English-blue?style=for-the-badge)](./README.md)
[![Türkçe](https://img.shields.io/badge/Dil-T%C3%BCrk%C3%A7e-red?style=for-the-badge)](./README.tr.md)

</div>

---

<div align="center">

[![Mozilla Add-on Version](https://img.shields.io/amo/v/meshy-downloader?style=for-the-badge\&label=mozilla%20add-on)](https://addons.mozilla.org/en-US/android/addon/meshy-downloader/)
[![License](https://img.shields.io/github/license/efebaykaraa/meshy_downloader?style=for-the-badge)](LICENSE)

[![Eklentiyi Ekle](https://img.shields.io/badge/EKLENT%C4%B0Y%C4%B0-AL-1497D4?style=for-the-badge\&logo=firefoxbrowser\&logoColor=white)](https://addons.mozilla.org/en-US/android/addon/meshy-downloader/)

</div>

---

# Meshy Downloader

Desteklenen yapay zekâ model üretim sitelerinde indirilebilir 3D modelleri algılayan ve tek tıkla `.glb` indirme penceresi sunan bir WXT + Svelte tarayıcı eklentisi.

Meshy Downloader şu anda şunları destekler:

* `meshy.ai`
* `tripo3d.ai`
* `studio.tripo3d.ai`

Eklenti başlangıçta yalnızca Meshy için geliştirilmişti. Artık sağlayıcı tabanlı bir mimari kullanıyor; böylece her desteklenen site kendi algılama, işleme ve indirme davranışına sahip oluyor.

## Özellikler

* Meshy modellerini algılar ve indirir.
* `tripo-data.rg1.data.tripo3d.com` üzerinden gelen Tripo3D `.glb` model isteklerini algılar.
* En yeni geçerli Tripo3D `tripo_pbr_model_*_meshopt.glb` isteğini aktif indirilebilir model olarak takip eder.
* `.webp`, `.jpg`, `.png`, `.js`, `.css` ve `.wasm` gibi Tripo3D önizleme ve statik dosyalarını yok sayar.
* Tripo3D modellerini kaydetmeden önce temizlenmiş `.glb` dosyalarına dönüştürür.
* Meshy ve Tripo3D mantığını sağlayıcıya özel durum yönetimiyle ayrı tutar.
* Desteklenen sağlayıcılar için ortak popup ve overlay arayüzü kullanır.

## Desteklenen Siteler

| Site                | Durum           | Notlar                                           |
| ------------------- | --------------- | ------------------------------------------------ |
| `meshy.ai`          | ✅ Destekleniyor | Mevcut Meshy algılama ve indirme davranışı       |
| `tripo3d.ai`        | ✅ Destekleniyor | Geçerli Tripo3D `.glb` model isteklerini algılar |
| `studio.tripo3d.ai` | ✅ Destekleniyor | Geçerli Tripo3D `.glb` model isteklerini algılar |

## Tarayıcı Desteği

| Tarayıcı | Durum           |
| -------- | --------------- |
| Chrome   | ✅ Çalışıyor     |
| Firefox  | ✅ Çalışıyor     |
| Safari   | ⚪ Test edilmedi |

## Gereksinimler

* Node.js 20+
* pnpm

## Kurulum

```bash
pnpm install
```

## Hazır Eklentiyi Kurma

Eklentinin hazır derlenmiş sürümleri [releases sayfasında](https://github.com/efebaykaraa/meshy_downloader/releases/tag/Stable) bulunabilir.

En güncel sürümü indirin ve tarayıcınıza yüklemek için aşağıdaki adımları izleyin.

### Chrome

1. İndirdiğiniz zip dosyasını çıkarın.
2. Chrome’u açın ve `chrome://extensions` adresine gidin.
3. Sağ üstten `Developer mode` seçeneğini etkinleştirin.
4. `Load unpacked` butonuna tıklayın.
5. Çıkardığınız klasörü seçin, örneğin `meshy-downloader-chrome`.

### Firefox

Yayınlanmış sürümü [Mozilla Add-ons sayfasından](https://addons.mozilla.org/en-US/android/addon/meshy-downloader/) kurabilirsiniz.

Elle kurulum için:

1. Firefox’u açın ve `about:debugging#/runtime/this-firefox` adresine gidin.
2. `Load Temporary Add-on` butonuna tıklayın.
3. İndirdiğiniz sıkıştırılmış zip dosyasını seçin, örneğin `meshy-downloader-v<version>-firefox.zip`.

## Chrome İçin Derleme

```bash
pnpm build
```

```text
Chrome -> Settings -> Extensions -> Load unpacked -> `.output/chrome-mv3` klasörünü seç
```

## Firefox İçin Derleme

```bash
pnpm build:firefox
```

```text
Firefox -> about:debugging#/runtime/this-firefox -> Load Temporary Add-on -> `.output/firefox-mv3/manifest.json` dosyasını seç
```

Firefox, `data_collection_permissions` hakkında bir WXT uyarısı gösterebilir. Eklenti yine de derlenir; bu uyarı Firefox eklenti mağazası gereksinimleriyle ilgilidir.

## Nasıl Çalışır?

Meshy Downloader, desteklenen sitelerdeki ağ trafiğini izler ve sayfanın istediği geçerli model dosyalarını algılar.

Tripo3D için eklenti yalnızca sayfanın doğal şekilde zaten istemiş olduğu model URL’lerini kullanır. İmzalı URL’leri değiştirmez, taklit etmez veya yeniden üretmez.

Geçerli bir Tripo3D modeli algılandığında, eklenti en yeni eşleşen model isteğini aktif indirilebilir model olarak kaydeder. Model yalnızca kullanıcı indirme butonuna tıkladığında işlenir.

## Tripo3D Model İşleme

Tripo3D modelleri indirilmeden önce temizlenir.

Eklenti şu işlemleri yapar:

1. Aktif olarak algılanmış `.glb` URL’sini çeker.

2. `EXT_meshopt_compression` sıkıştırmasını `meshoptimizer` kullanarak çözer.

3. `KHR_mesh_quantization` verisini `gltf-transform` kullanarak dequantize eder.

4. Temizlenmiş bir GLB dosyası üretir, örneğin:

   ```text
   tripo_pbr_model_<id>_cleaned.glb
   ```

5. Temizlenmiş çıktının şunları sağladığını doğrular:

   * geçerli bir GLB dosyası olması,
   * mesh içermesi,
   * artık `EXT_meshopt_compression` gerektirmemesi,
   * artık `KHR_mesh_quantization` gerektirmemesi.

Bu işleme yalnızca Tripo3D modellerine uygulanır. Meshy indirmeleri mevcut davranışını korur.

## Proje Yapısı

Önemli dosyalar:

```text
src/lib/website-state-machine.ts
src/lib/tripo-processing.ts
entrypoints/tripo.content/index.ts
entrypoints/tripo.content/Overlay.svelte
entrypoints/shared/OverlayShell.svelte
entrypoints/background.ts
entrypoints/popup/App.svelte
wxt.config.ts
```

## Bağımlılıklar

Ana model işleme bağımlılıkları:

* `@gltf-transform/core`
* `@gltf-transform/extensions`
* `@gltf-transform/functions`
* `meshoptimizer`

## Sorun Giderme

* Bir şey ters giderse sayfayı yenileyip tekrar deneyin.
* İndirmeyi denemeden önce modelin görünür olduğundan veya site tarafından yüklenmiş olduğundan emin olun.
* Tripo3D’de indirmek istediğiniz modele geçtikten sonra indirme butonuna tıklayın. Eklenti en yeni geçerli görünür model isteğini takip eder.
* Hata ayıklama logları sayfa konsoluna `[Meshy Downloader]` ön ekiyle yazdırılır.

## Doğrulama

Yayınlamadan önce şunları kontrol edin:

* Meshy modelleri eskisi gibi algılanıp indiriliyor.
* Tripo3D yalnızca geçerli `tripo_pbr_model_*_meshopt.glb` URL’lerini algılıyor.
* Birden fazla Tripo3D modeli arasında geçiş yapmak aktif modeli güncelliyor.
* Tripo3D indirmeleri Blender veya standart GLB görüntüleyicilerde açılabilen temizlenmiş GLB dosyaları üretiyor.
* Tripo3D temizleme işlemi Meshy veya alakasız sitelerde çalışmıyor.

Çalıştırın:

```bash
pnpm build
```

## Destek

Bu eklenti işinize yaradıysa GitHub’da yıldız bırakmayı veya Mozilla Add-ons üzerinde değerlendirme yapmayı düşünebilirsiniz.

<div align="center">

[![GitHub'da Yıldızla](https://img.shields.io/badge/GitHub%27da-Y%C4%B1ld%C4%B1zla-181717?style=for-the-badge\&logo=github\&logoColor=white)](https://github.com/efebaykaraa/meshy_downloader/stargazers)
[![Mozilla'da Değerlendir](https://img.shields.io/badge/Mozilla%27da-De%C4%9Ferlendir-FF7139?style=for-the-badge\&logo=firefoxbrowser\&logoColor=white)](https://addons.mozilla.org/en-US/android/addon/meshy-downloader/reviews/)

</div>

<img width="512" height="512" alt="Lütfen yıldız bırakın" src="https://github.com/user-attachments/assets/b0c81c23-ac7d-4206-b8b2-0c35edec0b89" />
