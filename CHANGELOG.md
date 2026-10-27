# Что нового · Changelog

[Русский](#русский) · [English](#english)

## Русский

### 1.2.0
- Выбор видеокарта или процессор (WebAssembly во всех ядрах): переключатель «Считать на: Видеокарте / Процессоре», автоматический переход на процессор, если видеокарта не работает.
- Слабые телефоны: маленькие первые порции для видеокарты, повторная мягкая попытка при сбросе, понятный текст ошибки.
- Английская карточка кошелька: «0.00 GRAM» с точкой.

### 1.1.1
- Телефоны: короткие запуски на видеокарте и автоматическое восстановление после «GPU device lost» / «mapAsync was not successful» без потери прогресса поиска.

### 1.1.0
- Подбор на видеокарте быстрее на 16 % (434 → ~500 тыс. фраз/с на RTX 5070 Ti).
- Режим «Любые позиции»: до 16 символов в любых клетках адреса.
- 3D-карточка кошелька с адресом, как в Telegram Wallet, и подсветкой ваших символов.
- Версия для телефона: сайт erechi.github.io/fancy, экран не гаснет во время поиска, нагрузка 50 % по умолчанию.

### 1.0.0
- Первый выпуск: поиск красивого адреса Telegram Wallet на видеокарте прямо в браузере, оформление кошелька со сменой ключа.

## English

### 1.2.0
- Choose GPU or CPU (WebAssembly on all cores): "Compute on: GPU / CPU" switch, automatic CPU fallback when the GPU doesn't work.
- Weak phones: small first GPU batches, a gentler retry after a reset, a clear error message.
- English wallet card: "0.00 GRAM" with a dot.

### 1.1.1
- Phones: short GPU dispatches and automatic recovery after "GPU device lost" / "mapAsync was not successful" without losing search progress.

### 1.1.0
- GPU search 16 % faster (434k → ~500k phrases/s on an RTX 5070 Ti).
- "Any positions" mode: up to 16 characters in any cells of the address.
- 3D wallet card showing the address like Telegram Wallet, with your characters highlighted.
- Phone version: erechi.github.io/fancy, the screen stays on while searching, 50 % load by default.

### 1.0.0
- First release: vanity Telegram Wallet addresses mined on the GPU right in the browser, wallet setup with key rotation.
