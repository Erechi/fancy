// Тексты интерфейса RU / EN. Значение — строка или функция от параметров.

const ru = {
  langName: 'RU',
  source: 'Исходный код',
  badgeLocal: '100% локально',
  heroTitle: ['Адрес, который', 'хочется показать'],
  heroLead:
    'Fancy подбирает адрес Telegram Wallet с вашим словом прямо на этом компьютере. Видеокарта перебирает сотни тысяч фраз в секунду, а все 24 слова остаются только у вас.',
  heroPoints: ['Бесплатно и без регистрации', 'Работает без сервера', 'Открытый код'],

  devChecking: 'Готовим видеокарту — при первом запуске это до 30 секунд…',
  devSelftest: (gpu) => `Найдена видеокарта ${gpu}. Сверяем её расчёты с процессором…`,
  devBench: 'Замеряем скорость вашего устройства…',
  devGpu: 'Видеокарта',
  devCpu: (n) => `Процессор · ${n} потоков`,
  perSec: 'фраз/с',
  gpuUnavailable: (e) => `Видеокарта недоступна (${e}). Откройте файл в свежем Chrome или Edge — будет в десятки раз быстрее.`,

  settings: 'Настройки поиска',
  yourText: 'Ваш текст',
  where: 'Где',
  atEnd: 'В конце',
  atStart: 'В начале',
  both: 'Начало + конец',
  gpuLoad: 'Нагрузка на видеокарту',
  powerNames: { 0.25: 'Тихий', 0.5: 'Эко', 0.75: 'Рекомендуемый', 1: 'Максимум' },
  powerNote: 'Рекомендуемый режим оставляет запас — карта тише и холоднее, а поиск лишь немного дольше. Видеопамять почти не используется: нагрузку задаёт именно этот процент.',
  waitBoth: '«Начало + конец» — считаются все символы вместе.',
  caseLabel: 'Регистр',
  caseAny: 'Любой',
  caseExact: 'Точный',
  popular: 'Популярное',
  hintAny: 'lucky, Lucky и LUCKY подойдут — так в разы быстрее.',
  hintExact: 'Буквы ровно в таком регистре — каждая буква примерно вдвое дольше.',
  allowed: 'Латиница, цифры, «-» и «_», до 8 символов.',
  err: {
    empty: 'Введите текст',
    chars: 'Только латиница, цифры, «-» и «_»',
    long: 'Не больше 8 символов',
    prefix3: 'В начале адреса после «UQ» может стоять только A, B, C или D',
  },
  attempts: 'Перебрать',
  median: 'Медиана',
  oneIn20: '1 из 20 дольше',
  measuring: 'замер…',
  longNote: 'Долго, но реально: можно оставить компьютер на ночь или на выходные. Поиск можно ставить на паузу.',
  tooLong: 'Нереально долго для этого устройства — сократите текст или выберите любой регистр.',
  feasibility: { fast: 'секунды', mid: 'минуты', slow: 'часы', insane: 'нереально долго' },
  advanced: 'Дополнительно',
  network: 'Сеть',
  engine: 'Чем считать',
  engineGpu: 'Видеокарта',
  engineCpu: 'Процессор',
  apiKey: 'Ключ toncenter API',
  apiKeyPh: 'необязательно — без ключа 1 запрос/с',
  start: 'Начать поиск',
  waitBench: 'Ждём замер скорости…',
  localNote: 'Всё считается на этом устройстве',

  // экран поиска
  back: 'Назад',
  huntTitle: (p) => `Ищем ${p}`,
  huntSub: (eng) => `${eng} · можно свернуть окно, вкладку не закрывайте`,
  running: 'Перебор идёт',
  paused: 'Пауза',
  checked: 'фраз проверено',
  speed: 'Скорость',
  time: 'Время',
  eta: 'Ориентир',
  chance: 'Шанс уже найти',
  lastCandidate: 'Последний кандидат',
  randomNote: 'Поиск случайный: может закончиться и раньше, и позже расчёта.',
  pause: 'Пауза',
  resume: 'Продолжить',
  power: 'Мощность',
  stop: 'Остановить',
  notifyHint: 'Когда адрес найдётся, прозвучит сигнал и появится уведомление (если браузер разрешит).',

  // находка
  foundTitle: 'Нашли!',
  foundSub: (t, n) => `Адрес с «${t}» после ${n} попыток`,
  toClaim: 'Оформить кошелёк',
  searchAgain: 'Искать ещё',
  copyAddr: 'Копировать адрес',
  copied: 'Скопировано',

  // таблица времени
  waitTitle: 'Сколько ждать на вашем устройстве',
  waitSub: (r) => `Медиана при текущей скорости ${r} фраз/с. В начале адреса — почти так же.`,
  chars: 'Символов',
  anyCase: 'Любой регистр',
  exactCase: 'Точный регистр',

  // мои адреса
  myTitle: 'Мои адреса',
  mySub: 'Хранятся только в этом браузере. Пока ключ не сменён, первые 12 слов — единственный доступ к адресу.',
  myEmpty: 'Здесь появятся найденные адреса.',
  status: { found: 'найден', funded: 'пополнен', switched: 'готов к импорту' },
  open: 'Открыть',
  del: 'Удалить',
  delFound: 'Удалить адрес? Если вы не записали 12 слов, он будет потерян навсегда.',
  delDone: 'Удалить запись с этого устройства? Убедитесь, что все 24 слова записаны.',

  // история поисков
  histTitle: 'История поисков',
  histEmpty: 'Пока пусто — запустите первый поиск.',
  histFound: 'найден',
  histStopped: 'остановлен',
  histClear: 'Очистить',

  // как это работает
  howTitle: 'Как это работает',
  how: [
    ['Поиск', 'Браузер перебирает случайные фразы из 12 слов, пока адрес не совпадёт с вашим текстом.'],
    ['Вторая половина', 'Браузер создаёт ещё 12 слов. Вместе — 24 слова Telegram Wallet.'],
    ['Пополнение', 'Отправьте ~0.05 GRAM на найденный адрес — это оплатит развёртывание.'],
    ['Смена ключа', 'Одна транзакция разворачивает кошелёк и переключает его на ваши 24 слова.'],
    ['Импорт', 'Telegram → Wallet → Импорт, вводите 24 слова. Готово.'],
  ],
  factsTitle: 'Почему это безопасно',
  facts: [
    ['Без сервера', 'У Fancy нет бэкенда. В сеть уходит только подписанная транзакция смены ключа — через публичный toncenter.'],
    ['Проверяемо', 'После смены ключа публичный ключ кошелька равен ключу ваших 24 слов — это видно в любом эксплорере.'],
    ['Открытый контракт', 'Кошелёк — официальный контракт WalletTg от ton-blockchain. Слова 1–12 после смены ключа ничего не подписывают.'],
  ],
  faqTitle: 'Вопросы',
  faq: [
    ['Почему бесплатно, если vanity.tg берёт деньги?', 'Они ищут адреса на своих видеокартах и платят за них. Fancy считает на вашей — поэтому платить некому.'],
    ['Что если закрыть вкладку во время поиска?', 'Поиск остановится, но найденные адреса сохраняются в браузере. Прогресс поиска не накапливается — каждая попытка случайна, начинать заново не хуже.'],
    ['Подойдёт ли адрес для Tonkeeper?', 'Нет: адрес вычислен для контракта Telegram Wallet (WalletTg). Импортируйте 24 слова именно в Telegram → Wallet.'],
    ['Можно ли доверять файлу?', 'Код открыт на GitHub. Можно собрать файл самому из исходников и сравнить контрольную сумму с релизом.'],
    ['Сколько GRAM нужно?', 'Около 0.05 GRAM на развёртывание и смену ключа — остаток останется на кошельке.'],
  ],
  footer: 'Не аффилировано с Telegram. Telegram Wallet — продукт его правообладателя. Используйте на свой риск; начните с короткого текста и небольшой суммы.',

  // оформление
  claimTitle: 'Оформление кошелька',
  collapse: 'Свернуть',
  s1: 'Запишите 24 слова',
  s1text: 'Слова 1–12 нашёл поиск — они задают адрес. Слова 13–24 только что создал ваш браузер — на них переключится ключ. Запишите все 24 по порядку, на бумаге, без скриншотов.',
  anchorLabel: 'Слова 1–12 · задают адрес',
  signingLabel: 'Слова 13–24 · ваш ключ',
  reveal: 'Показать слова — убедитесь, что никто не смотрит',
  copy24: 'Скопировать 24 слова',
  wrote: 'Я записал все 24 слова по порядку',
  s2: 'Пополните адрес и смените ключ',
  s2text: (a) => `Отправьте около <b>${a} GRAM</b> на найденный адрес из любого кошелька — этим оплачивается развёртывание. Остаток останется на кошельке.`,
  openWallet: 'Открыть в кошельке',
  balance: 'Баланс',
  contract: 'контракт',
  deployed: 'развёрнут',
  notDeployed: 'ещё не развёрнут',
  waitingFunds: 'ждём пополнения…',
  checkingChain: 'Проверяем баланс…',
  netError: (e) => `Не удалось связаться с toncenter: ${e}. Повторим через несколько секунд.`,
  switchKey: 'Сменить ключ на мои 24 слова',
  sending: 'Отправляем…',
  sent: 'Транзакция отправлена. Ждём подтверждения (обычно 5–20 секунд)…',
  errPrefix: 'Ошибка: ',
  errAnchor: 'слова 1–12 не дают этот адрес — запись повреждена',
  errForeignKey: 'в контракте чужой ключ — продолжать нельзя',
  errState: (s) => `состояние аккаунта: ${s}`,
  errTimeout: 'подтверждение не пришло за 2 минуты. Проверьте адрес в эксплорере и нажмите ещё раз',
  s3: 'Импорт в Telegram Wallet',
  import1: 'Telegram → Wallet → <b>Импортировать кошелёк</b>, 24 слова.',
  import2: 'Введите слова <b>в показанном порядке</b> — с 1 по 24.',
  import3: (end) => `Проверьте, что адрес в Wallet заканчивается на <b class="mono">${end}</b>.`,
  switchedOk: 'Ключ сменён: публичный ключ кошелька совпадает с вашими 24 словами. Слова 1–12 сами по себе больше ничего не могут.',
  explorer: 'Посмотреть в эксплорере',
  afterImport: 'После импорта удалите запись в «Мои адреса» — так фраза не останется в этом браузере.',
  stopError: (e) => `Поиск остановлен: ${e}`,
  notifTitle: 'Fancy: адрес найден',
};

const en = {
  langName: 'EN',
  source: 'Source code',
  badgeLocal: '100% local',
  heroTitle: ['An address', 'worth showing off'],
  heroLead:
    'Fancy finds a Telegram Wallet address with your word in it — right on this computer. Your GPU checks hundreds of thousands of phrases per second, and all 24 words stay with you.',
  heroPoints: ['Free, no sign-up', 'No server at all', 'Open source'],

  devChecking: 'Preparing the GPU — up to 30 seconds on first run…',
  devSelftest: (gpu) => `Found ${gpu}. Cross-checking GPU results against the CPU…`,
  devBench: 'Measuring your device speed…',
  devGpu: 'GPU',
  devCpu: (n) => `CPU · ${n} threads`,
  perSec: 'phrases/s',
  gpuUnavailable: (e) => `GPU unavailable (${e}). Open the file in a recent Chrome or Edge — it is dozens of times faster.`,

  settings: 'Search settings',
  yourText: 'Your text',
  where: 'Where',
  atEnd: 'At the end',
  atStart: 'At the start',
  both: 'Start + end',
  gpuLoad: 'GPU load',
  powerNames: { 0.25: 'Quiet', 0.5: 'Eco', 0.75: 'Recommended', 1: 'Maximum' },
  powerNote: 'The recommended mode leaves headroom — the card runs quieter and cooler, the search only slightly longer. Almost no VRAM is used: this percentage is what sets the load.',
  waitBoth: '"Start + end" counts all characters together.',
  caseLabel: 'Case',
  caseAny: 'Any',
  caseExact: 'Exact',
  popular: 'Popular',
  hintAny: 'lucky, Lucky and LUCKY all match — much faster.',
  hintExact: 'Letters exactly as typed — each letter takes about twice as long.',
  allowed: 'Latin letters, digits, "-" and "_", up to 8 characters.',
  err: {
    empty: 'Type some text',
    chars: 'Only Latin letters, digits, "-" and "_"',
    long: 'At most 8 characters',
    prefix3: 'At the start, after "UQ" only A, B, C or D is possible',
  },
  attempts: 'Attempts',
  median: 'Median',
  oneIn20: '1 in 20 longer',
  measuring: 'measuring…',
  longNote: 'Long but doable: leave the computer on overnight or for a weekend. You can pause any time.',
  tooLong: 'Unrealistically long for this device — shorten the text or choose any case.',
  feasibility: { fast: 'seconds', mid: 'minutes', slow: 'hours', insane: 'forever' },
  advanced: 'Advanced',
  network: 'Network',
  engine: 'Compute on',
  engineGpu: 'GPU',
  engineCpu: 'CPU',
  apiKey: 'toncenter API key',
  apiKeyPh: 'optional — 1 request/s without a key',
  start: 'Start search',
  waitBench: 'Waiting for the speed test…',
  localNote: 'Everything runs on this device',

  back: 'Back',
  huntTitle: (p) => `Hunting ${p}`,
  huntSub: (eng) => `${eng} · you can minimize the window, keep the tab open`,
  running: 'Searching',
  paused: 'Paused',
  checked: 'phrases checked',
  speed: 'Speed',
  time: 'Time',
  eta: 'Estimate',
  chance: 'Chance so far',
  lastCandidate: 'Last candidate',
  randomNote: 'The search is random: it may finish sooner or later than estimated.',
  pause: 'Pause',
  resume: 'Resume',
  power: 'Power',
  stop: 'Stop',
  notifyHint: 'When an address is found you will hear a sound and get a notification (if the browser allows).',

  foundTitle: 'Found it!',
  foundSub: (t, n) => `Address with "${t}" after ${n} attempts`,
  toClaim: 'Set up the wallet',
  searchAgain: 'Search again',
  copyAddr: 'Copy address',
  copied: 'Copied',

  waitTitle: 'How long on your device',
  waitSub: (r) => `Median at the current speed of ${r} phrases/s. Prefixes take about the same.`,
  chars: 'Chars',
  anyCase: 'Any case',
  exactCase: 'Exact case',

  myTitle: 'My addresses',
  mySub: 'Stored only in this browser. Until the key is switched, words 1–12 are the only access to the address.',
  myEmpty: 'Found addresses will appear here.',
  status: { found: 'found', funded: 'funded', switched: 'ready to import' },
  open: 'Open',
  del: 'Delete',
  delFound: 'Delete this address? If you did not write down the 12 words it is lost forever.',
  delDone: 'Delete this record from the device? Make sure all 24 words are written down.',

  histTitle: 'Search history',
  histEmpty: 'Empty for now — start your first search.',
  histFound: 'found',
  histStopped: 'stopped',
  histClear: 'Clear',

  howTitle: 'How it works',
  how: [
    ['Search', 'Your browser tries random 12-word phrases until the address matches your text.'],
    ['Second half', 'The browser creates 12 more words. Together — 24 Telegram Wallet words.'],
    ['Top up', 'Send ~0.05 GRAM to the found address to pay for deployment.'],
    ['Key switch', 'One transaction deploys the wallet and switches it to your 24 words.'],
    ['Import', 'Telegram → Wallet → Import, enter the 24 words. Done.'],
  ],
  factsTitle: 'Why it is safe',
  facts: [
    ['No server', 'Fancy has no backend. Only the signed key-switch transaction goes out — via public toncenter.'],
    ['Verifiable', 'After the switch the wallet public key equals the key of your 24 words — visible in any explorer.'],
    ['Open contract', 'The wallet is the official WalletTg contract by ton-blockchain. After the switch words 1–12 sign nothing.'],
  ],
  faqTitle: 'FAQ',
  faq: [
    ['Why free if vanity.tg charges?', 'They mine on their own GPUs and pay for them. Fancy uses yours — so nobody needs paying.'],
    ['What if I close the tab while searching?', 'The search stops, but found addresses stay saved. Progress does not accumulate — every attempt is random, so starting over is no worse.'],
    ['Will the address work in Tonkeeper?', 'No: it is computed for the Telegram Wallet contract (WalletTg). Import the 24 words into Telegram → Wallet.'],
    ['Can I trust the file?', 'The code is open on GitHub. You can build the file from source and compare the checksum with the release.'],
    ['How much GRAM do I need?', 'About 0.05 GRAM for deployment and the key switch — the rest stays in the wallet.'],
  ],
  footer: 'Not affiliated with Telegram. Telegram Wallet is a product of its respective owner. Use at your own risk; start with short text and a small amount.',

  claimTitle: 'Wallet setup',
  collapse: 'Collapse',
  s1: 'Write down 24 words',
  s1text: 'Words 1–12 come from the search — they define the address. Words 13–24 were just created by your browser — the key switches to them. Write all 24 in order, on paper, no screenshots.',
  anchorLabel: 'Words 1–12 · define the address',
  signingLabel: 'Words 13–24 · your key',
  reveal: 'Reveal the words — make sure nobody is watching',
  copy24: 'Copy 24 words',
  wrote: 'I wrote down all 24 words in order',
  s2: 'Top up and switch the key',
  s2text: (a) => `Send about <b>${a} GRAM</b> to the found address from any wallet — it pays for deployment. The rest stays in the wallet.`,
  openWallet: 'Open in wallet',
  balance: 'Balance',
  contract: 'contract',
  deployed: 'deployed',
  notDeployed: 'not deployed yet',
  waitingFunds: 'waiting for funds…',
  checkingChain: 'Checking balance…',
  netError: (e) => `Could not reach toncenter: ${e}. Retrying in a few seconds.`,
  switchKey: 'Switch the key to my 24 words',
  sending: 'Sending…',
  sent: 'Transaction sent. Waiting for confirmation (usually 5–20 seconds)…',
  errPrefix: 'Error: ',
  errAnchor: 'words 1–12 do not produce this address — the record is corrupted',
  errForeignKey: 'the contract holds someone else’s key — cannot continue',
  errState: (s) => `account state: ${s}`,
  errTimeout: 'no confirmation within 2 minutes. Check the address in an explorer and press again',
  s3: 'Import into Telegram Wallet',
  import1: 'Telegram → Wallet → <b>Import wallet</b>, 24 words.',
  import2: 'Enter the words <b>in the order shown</b> — 1 to 24.',
  import3: (end) => `Check that the address in Wallet ends with <b class="mono">${end}</b>.`,
  switchedOk: 'Key switched: the wallet public key matches your 24 words. Words 1–12 alone can no longer do anything.',
  explorer: 'View in explorer',
  afterImport: 'After importing, delete the record in “My addresses” so the phrase does not stay in this browser.',
  stopError: (e) => `Search stopped: ${e}`,
  notifTitle: 'Fancy: address found',
};

const DICTS = { ru, en };

function detect() {
  try {
    const saved = localStorage.getItem('fancy.lang');
    if (saved && DICTS[saved]) return saved;
  } catch {
    /* без хранилища — по языку браузера */
  }
  return (navigator.language || '').toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export let lang = detect();

export function setLang(l) {
  lang = l;
  try {
    localStorage.setItem('fancy.lang', l);
  } catch {
    /* не страшно */
  }
  document.documentElement.lang = l;
}

/** t('key') или t('key', ...args) для функций; t('err.chars') — вложенные ключи. */
export function t(key, ...args) {
  let v = key.split('.').reduce((o, k) => o?.[k], DICTS[lang]);
  if (v === undefined) v = key.split('.').reduce((o, k) => o?.[k], ru);
  return typeof v === 'function' ? v(...args) : v;
}

export function locale() {
  return lang === 'ru' ? 'ru-RU' : 'en-US';
}
