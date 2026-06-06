<div align="center">

[![English](https://img.shields.io/badge/Language-English-blue?style=for-the-badge)](./README.md)
[![Türkçe](https://img.shields.io/badge/Dil-T%C3%BCrk%C3%A7e-red?style=for-the-badge)](./README.tr.md)

</div>

---

<div align="center">

[![Mozilla Add-on Version](https://img.shields.io/amo/v/meshy-downloader?style=for-the-badge&label=mozilla%20add-on)](https://addons.mozilla.org/en-US/android/addon/meshy-downloader/)
[![Chrome Web Store Version](https://img.shields.io/chrome-web-store/v/gmiabmjbibonhgpdbgoinabillaeonpk?style=for-the-badge&label=chrome%20web%20store)](https://chromewebstore.google.com/detail/meshy-downloader/gmiabmjbibonhgpdbgoinabillaeonpk)
[![License](https://img.shields.io/github/license/efebaykaraa/meshy_downloader?style=for-the-badge)](LICENSE)

[![Firefox Eklentisini Al](https://img.shields.io/badge/FIREFOX%20EKLENT%C4%B0S%C4%B0N%C4%B0-AL-1497D4?style=for-the-badge&logo=firefoxbrowser&logoColor=white)](https://addons.mozilla.org/en-US/android/addon/meshy-downloader/)
[![Chrome'dan Al](https://img.shields.io/badge/CHROME'DAN-AL-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/meshy-downloader/gmiabmjbibonhgpdbgoinabillaeonpk)

</div>

---

# Meshy Downloader

Desteklenen yapay zekâ model üretim sitelerinde indirilebilir 3D modelleri algılayan ve tek tıkla `.glb` indirme penceresi sunan bir WXT + Svelte tarayıcı eklentisi.

Meshy Downloader şu anda şunları destekler:

* `meshy.ai`
* `tripo3d.ai`

Eklenti başlangıçta yalnızca Meshy için yapılmıştı, çünkü belli ki her site model dosyalarını servis etmek için kendi küçük garip yöntemini icat etmek zorunda. Artık sağlayıcı tabanlı bir mimari kullanıyor; böylece her desteklenen site için algılama, işleme ve indirme davranışı ayrı tutulabiliyor.

## Özellikler

* Meshy modellerini algılar ve indirir.
* Tripo3D `.glb` model isteklerini algılar.
* En yeni geçerli Tripo3D `tripo_pbr_model_*_meshopt.glb` isteğini aktif indirilebilir model olarak izler.
* `.webp`, `.jpg`, `.png`, `.js`, `.css` ve `.wasm` gibi Tripo3D önizleme ve statik dosyalarını yok sayar.
* Tripo3D modellerini kaydetmeden önce temizlenmiş `.glb` dosyalarına dönüştürür.
* Meshy ve Tripo3D mantığını sağlayıcıya özel durum yönetimiyle birbirinden ayrı tutar.
* Desteklenen sağlayıcılar için ortak popup ve overlay arayüzü kullanır.
* Mozilla Add-ons ve Chrome Web Store üzerinden kullanılabilir.

## Desteklenen Siteler

| Site | Durum | Notlar |
| --- | --- | --- |
| `meshy.ai` | ✅ Destekleniyor | Mevcut Meshy algılama ve indirme davranışı |
| `tripo3d.ai` | ✅ Destekleniyor | Geçerli Tripo3D `.glb` model isteklerini algılar |

## Tarayıcı Desteği

| Tarayıcı | Durum | Kurulum |
| --- | --- | --- |
| Chrome | ✅ Çalışıyor | [Chrome Web Store](https://chromewebstore.google.com/detail/meshy-downloader/gmiabmjbibonhgpdbgoinabillaeonpk) |
| Firefox | ✅ Çalışıyor | [Mozilla Add-ons](https://addons.mozilla.org/en-US/android/addon/meshy-downloader/) |
| Safari | ⚪ Test edilmedi | Mevcut değil |

## Gereksinimler

* Node.js 20+
* pnpm

## Kurulum

```bash
pnpm install
```

## Tarayıcı Mağazalarından Kurulum

### Chrome

Yayınlanmış Chrome sürümünü [Chrome Web Store](https://chromewebstore.google.com/detail/meshy-downloader/gmiabmjbibonhgpdbgoinabillaeonpk) üzerinden kurabilirsiniz.

### Firefox

Yayınlanmış Firefox sürümünü [Mozilla Add-ons sayfasından](https://addons.mozilla.org/en-US/android/addon/meshy-downloader/) kurabilirsiniz.

## Hazır Eklentiyi Elle Kurma

Eklentinin hazır derlenmiş sürümleri [releases sayfasında](https://github.com/efebaykaraa/meshy_downloader/releases/tag/Stable) bulunabilir.

En güncel sürümü indirin ve eklentiyi tarayıcınıza elle yüklemek için aşağıdaki adımları izleyin.

### Chrome

1. İndirdiğiniz zip dosyasını çıkarın.
2. Chrome’u açın ve `chrome://extensions` adresine gidin.
3. Sağ üstten `Developer mode` seçeneğini etkinleştirin.
4. `Load unpacked` butonuna tıklayın.
5. Çıkardığınız klasörü seçin, örneğin `meshy-downloader-chrome`.

### Firefox

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

Meshy Downloader, desteklenen sitelerdeki ağ etkinliğini izler ve sayfa tarafından istenen geçerli model dosyalarını algılar.

Tripo3D için eklenti yalnızca sayfanın doğal olarak zaten istemiş olduğu model URL’lerini kullanır. İmzalı URL’leri değiştirmez, taklit etmez veya yeniden üretmez.

Geçerli bir Tripo3D modeli algılandığında, eklenti en yeni eşleşen model isteğini aktif indirilebilir model olarak kaydeder. Model yalnızca kullanıcı indirme butonuna tıkladıktan sonra işlenir.

## Tripo3D Model İşleme

Tripo3D modelleri indirilmeden önce temizlenir.

Eklenti:

1. Aktif olarak algılanmış `.glb` URL’sini çeker.

2. `meshoptimizer` kullanarak `EXT_meshopt_compression` uzantısını çözer.

3. `gltf-transform` kullanarak `KHR_mesh_quantization` verisini dequantize eder.

4. Temizlenmiş bir GLB dosyası yazar. Örneğin:

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
* Tripo3D üzerinde indirmek istediğiniz modele geçtikten sonra indirme butonuna tıklayın. Eklenti en yeni geçerli görünür model isteğini izler.
* Hata ayıklama logları sayfa konsoluna `[Meshy Downloader]` ön ekiyle yazdırılır.

## Doğrulama

Yayınlamadan önce şunları kontrol edin:

* Meshy modelleri eskisi gibi algılanıyor ve indiriliyor.
* Tripo3D yalnızca geçerli `tripo_pbr_model_*_meshopt.glb` URL’lerini algılıyor.
* Birden fazla Tripo3D modeli arasında geçiş yapmak aktif modeli güncelliyor.
* Tripo3D indirmeleri Blender’da veya standart bir GLB görüntüleyicide açılan temizlenmiş GLB dosyaları üretiyor.
* Tripo3D temizleme işlemi Meshy veya alakasız sitelerde çalışmıyor.
* Chrome ve Firefox derlemeleri yayımlamadan önce çalışıyor.

Çalıştırın:

```bash
pnpm build
pnpm build:firefox
```

## Destek

Bu eklenti işinize yaradıysa depoya yıldız vermeyi veya Mozilla Add-ons / Chrome Web Store üzerinde değerlendirme bırakmayı düşünebilirsiniz.

<div align="center">

[![GitHub'da Yıldızla](https://img.shields.io/badge/GitHub'da-Y%C4%B1ld%C4%B1zla-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/efebaykaraa/meshy_downloader/stargazers)
[![Mozilla'da Değerlendir](https://img.shields.io/badge/Mozilla'da-De%C4%9Ferlendir-FF7139?style=for-the-badge&logo=firefoxbrowser&logoColor=white)](https://addons.mozilla.org/en-US/android/addon/meshy-downloader/reviews/)
[![Chrome'da Değerlendir](https://img.shields.io/badge/Chrome'da-De%C4%9Ferlendir-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/meshy-downloader/gmiabmjbibonhgpdbgoinabillaeonpk)

</div>

<img width="512" height="512" alt="Lütfen yıldız bırakın" src="https://github.com/user-attachments/assets/b0c81c23-ac7d-4206-b8b2-0c35edec0b89" />