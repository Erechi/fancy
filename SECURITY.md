# Безопасность / Security

## Сообщить об уязвимости

Пожалуйста, **не создавайте публичный issue** для уязвимостей. Используйте приватный отчёт:
вкладка **Security** этого репозитория → **Report a vulnerability**.

Особенно важно всё, что может привести к:

- утечке слов или приватных ключей за пределы браузера;
- предсказуемой энтропии (слабые или повторяющиеся фразы);
- неверному адресу или ключу (GPU и CPU считают по-разному, а проверка это пропустила);
- транзакции смены ключа, которой можно злоупотребить (повтор, подмена получателя и т. п.).

## Модель угроз

- Fancy работает без сервера. Сеть нужна только на шаге оформления — для запросов к `toncenter.com`.
- Энтропия берётся из `crypto.getRandomValues`. На видеокарте каждый запуск получает свежие 128 бит, и в каждом потоке они уникальны.
- Слова хранятся в `localStorage` браузера, пока пользователь их не удалит. Расширения браузера с доступом к странице и вредоносное ПО на компьютере вне зоны защиты Fancy.

---

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Use **Security** → **Report a vulnerability** on this repository.

Especially relevant: leaking words or private keys outside the browser, predictable entropy, wrong address or key (GPU/CPU mismatch not caught), and abuse of the key-switch transaction (replay, recipient substitution).

Threat model: no server; the network is only used during wallet setup (`toncenter.com`); entropy comes from `crypto.getRandomValues` (fresh 128 bits per GPU dispatch, unique per thread); words are kept in the browser's `localStorage` until deleted. Malicious browser extensions or malware on the computer are out of scope.
