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
  feasibility: { fast: 'секунды', mid: 'минуты', slow: 'часы', long: 'дни', insane: 'нереально долго' },
  etaSub: (d) => `медиана, редко до ${d}`,
  etaInstant: 'почти мгновенно',
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

  // живая карточка
  liveReady: 'Готов к поиску',
  liveNoGpu: 'Нужна видеокарта',
  liveEta: 'До находки ≈',
  liveElapsed: 'С запуска',
  liveNotStarted: 'поиск не запущен',

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


  // как это работает
  howTitle: 'Как это работает',
  howSub: 'Шесть шагов от текста до красивого адреса в Telegram Wallet. Первые три происходят только на вашем компьютере.',
  how: [
    ['Вы выбираете текст', 'Окончание, начало или оба сразу. Fancy мгновенно считает, сколько вариантов придётся перебрать и сколько это займёт именно на вашей видеокарте — ещё до запуска.'],
    ['Видеокарта ищет', 'Каждую секунду она создаёт сотни тысяч случайных фраз из 12 слов и для каждой вычисляет адрес Telegram Wallet. Как только адрес совпадает с вашим текстом — поиск останавливается и звучит сигнал.'],
    ['Вы записываете 24 слова', 'Найденные 12 слов задают адрес. Ещё 12 создаёт ваш браузер — это ваш будущий ключ. Вместе получается обычная фраза Telegram Wallet из 24 слов. Запишите её на бумаге.'],
    ['Пополняете адрес', 'Адрес уже существует, но кошелька-контракта в блокчейне ещё нет. Отправьте на адрес немного GRAM с любого кошелька — из них оплатится развёртывание, остаток останется вашим.'],
    ['Fancy меняет ключ', 'Одна транзакция разворачивает кошелёк и переключает его ключ на ваши 24 слова. Адрес остаётся прежним, а первые 12 слов сами по себе больше ничего не подписывают. Транзакцию видно в любом эксплорере.'],
    ['Импортируете в Wallet', 'Telegram → Wallet → «Импортировать кошелёк» → 24 слова по порядку. Проверьте, что адрес совпадает, — и пользуйтесь. Запись в Fancy после этого можно удалить.'],
  ],
  factsTitle: 'Почему это безопасно',
  facts: [
    ['Без сервера', 'У Fancy нет бэкенда. В сеть уходит только подписанная транзакция смены ключа — через публичный toncenter.'],
    ['Проверяемо', 'После смены ключа публичный ключ кошелька равен ключу ваших 24 слов — это видно в любом эксплорере.'],
    ['Открытый контракт', 'Кошелёк — официальный контракт WalletTg от ton-blockchain. Слова 1–12 после смены ключа ничего не подписывают.'],
  ],
  faqTitle: 'Вопросы',
  faq: [
    ['Почему это бесплатно, если vanity.tg берёт деньги?', 'Они ищут адреса на своих видеокартах и платят за их аренду. Fancy считает на вашей — платить некому.'],
    ['Зачем нужно пополнять адрес?', 'Найденный адрес — пока только вычисленное место в блокчейне. Сам кошелёк-контракт появляется после первой транзакции, а оплачивает её сам кошелёк. Поэтому сначала на него нужно положить немного GRAM. Всё, что не ушло на комиссию, остаётся на вашем кошельке.'],
    ['Можно ли закрыть вкладку или свернуть окно во время поиска?', 'Свернуть окно или переключиться на другую вкладку можно — поиск продолжится. Закрывать вкладку нельзя: поиск остановится. Найденные адреса сохраняются, а начать заново не хуже — каждая попытка случайна, накопленный «прогресс» ничего не даёт.'],
    ['Подойдёт ли адрес для Tonkeeper, MyTonWallet и других кошельков?', 'Нет. Адрес вычислен для контракта Telegram Wallet (WalletTg), а Tonkeeper, MyTonWallet и другие используют контракты v4/v5 — по тем же 24 словам они покажут другой, пустой адрес. Импортируйте слова именно в Telegram → Wallet. Отправлять GRAM на ваш адрес можно из любого кошелька.'],
    ['Что будет, если я не записал слова?', 'Восстановить их нельзя — их нет ни у кого, кроме вашего браузера. Пока запись есть в «Мои адреса», слова можно посмотреть там. После удаления записи или очистки браузера доступ пропадёт навсегда.'],
    ['Можно ли доверять файлу?', 'Код открыт на GitHub. Fancy работает без сервера: в сеть уходит только подписанная транзакция смены ключа. Можно собрать файл из исходников самому и сравнить контрольную сумму с релизом.'],
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
  feasibility: { fast: 'seconds', mid: 'minutes', slow: 'hours', long: 'days', insane: 'forever' },
  etaSub: (d) => `median, rarely up to ${d}`,
  etaInstant: 'almost instant',
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

  liveReady: 'Ready to search',
  liveNoGpu: 'GPU required',
  liveEta: 'Time to find ≈',
  liveElapsed: 'Since start',
  liveNotStarted: 'not started',
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


  howTitle: 'How it works',
  howSub: 'Six steps from your text to a beautiful Telegram Wallet address. The first three happen only on your computer.',
  how: [
    ['You pick the text', 'End, start or both. Fancy instantly calculates how many variants it has to try and how long that takes on your particular GPU — before you start.'],
    ['Your GPU searches', 'Every second it creates hundreds of thousands of random 12-word phrases and computes the Telegram Wallet address for each. As soon as one matches your text, the search stops and you hear a signal.'],
    ['You write down 24 words', 'The found 12 words define the address. Your browser creates 12 more — your future key. Together they make a regular 24-word Telegram Wallet phrase. Write it down on paper.'],
    ['You top up the address', 'The address already exists, but the wallet contract is not on-chain yet. Send a little GRAM from any wallet — it pays for the deployment, the rest stays yours.'],
    ['Fancy switches the key', 'One transaction deploys the wallet and switches its key to your 24 words. The address stays the same, and words 1–12 alone can no longer sign anything. The transaction is visible in any explorer.'],
    ['You import into Wallet', 'Telegram → Wallet → "Import wallet" → the 24 words in order. Check that the address matches — done. You can delete the record in Fancy afterwards.'],
  ],
  factsTitle: 'Why it is safe',
  facts: [
    ['No server', 'Fancy has no backend. Only the signed key-switch transaction goes out — via public toncenter.'],
    ['Verifiable', 'After the switch the wallet public key equals the key of your 24 words — visible in any explorer.'],
    ['Open contract', 'The wallet is the official WalletTg contract by ton-blockchain. After the switch words 1–12 sign nothing.'],
  ],
  faqTitle: 'FAQ',
  faq: [
    ['Why is it free if vanity.tg charges?', 'They search on their own GPUs and pay for renting them. Fancy computes on yours — nobody needs paying.'],
    ['Why do I need to top up the address?', 'A found address is just a computed spot on the blockchain. The wallet contract appears after the first transaction, and that transaction is paid by the wallet itself. So first put a little GRAM on it. Whatever is not spent on fees stays in your wallet.'],
    ['Can I close the tab or minimize the window while searching?', 'Minimizing the window or switching tabs is fine — the search continues. Closing the tab stops it. Found addresses stay saved, and starting over is no worse — every attempt is random, accumulated "progress" means nothing.'],
    ['Will the address work in Tonkeeper, MyTonWallet and other wallets?', 'No. The address is computed for the Telegram Wallet contract (WalletTg), while Tonkeeper, MyTonWallet and others use v4/v5 contracts — the same 24 words would show a different, empty address there. Import the words into Telegram → Wallet. Anyone can send GRAM to your address from any wallet.'],
    ['What if I did not write the words down?', 'They cannot be recovered — nobody but your browser has them. While the record is in "My addresses" you can view the words there. After deleting the record or clearing the browser, access is lost forever.'],
    ['Can I trust the file?', 'The code is open on GitHub. Fancy has no server: only the signed key-switch transaction goes out. You can build the file from source yourself and compare the checksum with the release.'],
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
