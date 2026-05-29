<div align="center">

[![English](https://img.shields.io/badge/Language-English-blue?style=for-the-badge)](./README.md)
[![Türkçe](https://img.shields.io/badge/Dil-T%C3%BCrk%C3%A7e-red?style=for-the-badge)](./README.tr.md)

</div>

---

<div align="center">

[![Mozilla Add-on Version](https://img.shields.io/amo/v/meshy-downloader?style=for-the-badge&label=mozilla%20add-on)](https://addons.mozilla.org/en-US/android/addon/meshy-downloader/)
[![Mozilla Add-on Rating](https://img.shields.io/amo/stars/meshy-downloader?style=for-the-badge&label=stars)](https://addons.mozilla.org/en-US/android/addon/meshy-downloader/reviews/)
[![License](https://img.shields.io/github/license/efebaykaraa/meshy_downloader?style=for-the-badge)](LICENSE)

[![Mozilla Add-on Users](https://img.shields.io/amo/users/meshy-downloader?style=for-the-badge&label=users)](https://addons.mozilla.org/en-US/android/addon/meshy-downloader/)
[![Mozilla Weekly Downloads](https://img.shields.io/amo/dw/meshy-downloader?style=for-the-badge&label=weekly%20downloads)](https://addons.mozilla.org/en-US/android/addon/meshy-downloader/)
[![GitHub Stars](https://img.shields.io/github/stars/efebaykaraa/meshy_downloader?style=for-the-badge&logo=github)](https://github.com/efebaykaraa/meshy_downloader/stargazers)

---

[![Eklentiyi Ekle](https://img.shields.io/badge/EKLENT%C4%B0Y%C4%B0-AL-1497D4?style=for-the-badge&logo=firefoxbrowser&logoColor=white)](https://addons.mozilla.org/en-US/android/addon/meshy-downloader/)

</div>

---

`meshy.ai` üzerinde okunamaz hale getirilmiş üç boyutlu model verilerini algılayan ve tek tıkla `.glb` formatında indirme penceresi sunan bir WXT + Svelte tarayıcı eklentisi.

Meshy.ai üzerindeki modelleri ücretsiz olarak algılar ve indirmenizi sağlar.

## Tarayıcı Desteği

| Tarayıcı | Durum |
| --- | --- |
| Chrome | ✅ Çalışıyor |
| Firefox | ✅ Çalışıyor |
| Safari | ⚪ Test edilmedi |

## Gereksinimler

- Node.js 20+
- pnpm

## Kurulum

```bash
pnpm install
```

## Hazır Eklentiyi Kurma

Eklentinin hazır derlenmiş sürümleri [releases sayfasında](https://github.com/efebaykaraa/meshy_downloader/releases/tag/Stable) bulunabilir. En güncel sürümü indirin ve tarayıcınıza yüklemek için aşağıdaki adımları izleyin.

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

## Sorun Giderme

- Bir şey ters giderse sayfayı yenileyip tekrar deneyin.
- Hata ayıklama logları sayfa konsoluna `[Meshy Downloader]` ön ekiyle yazdırılır.

## Destek

Bu eklenti işinize yaradıysa Github'da yıldız bırakmayı ve Mozilla Add-ons üzerinde değerlendirmeyi düşünebilirsiniz.

<div align="center">

[![GitHub'da Yıldızla](https://img.shields.io/badge/GitHub%27da-Y%C4%B1ld%C4%B1zla-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/efebaykaraa/meshy_downloader/stargazers)
[![Mozilla'da Değerlendir](https://img.shields.io/badge/Mozilla%27da-De%C4%9Ferlendir-FF7139?style=for-the-badge&logo=firefoxbrowser&logoColor=white)](https://addons.mozilla.org/en-US/android/addon/meshy-downloader/reviews/)

</div>

<img width="512" height="512" alt="Lütfen yıldız bırakın" src="https://github.com/user-attachments/assets/b0c81c23-ac7d-4206-b8b2-0c35edec0b89" />