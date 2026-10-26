// Генератор развёрнутого умножения и возведения в квадрат в GF(2^255 - 19) для vanity.wgsl.
// Лимбы по 16 бит (≤ 0xffff на входе), произведение лимбов < 2^32. Каждое произведение делим
// на младшие и старшие 16 бит и копим их в разных колонках: суммы < 2^21, переносов и сравнений
// внутри умножения нет. Индексы только константные — компилятор держит всё в регистрах.

function columns(terms) {
  // terms: [i, j, множитель 1|2] → колонки lo[k] и hi[k] (hi уже сдвинута на 16 бит выше)
  const lo = Array.from({ length: 32 }, () => []);
  const hi = Array.from({ length: 33 }, () => []);
  for (const [i, j, m] of terms) {
    const p = `p${i}_${j}`;
    lo[i + j].push(m === 2 ? `((${p} & 0xffffu) << 1u)` : `(${p} & 0xffffu)`);
    hi[i + j + 1].push(m === 2 ? `((${p} >> 16u) << 1u)` : `(${p} >> 16u)`);
  }
  return { lo, hi };
}

function body(name, args, mulExpr, terms) {
  const L = [`fn ${name}(${args}) -> Fe {`];
  for (let i = 0; i < 16; i++) L.push(`  let a${i} = a[${i}];`);
  if (args.includes('b:')) for (let i = 0; i < 16; i++) L.push(`  let b${i} = b[${i}];`);
  for (const [i, j] of terms) L.push(`  let p${i}_${j} = ${mulExpr(i, j)};`);
  const { lo, hi } = columns(terms);
  // r[k] = lo[k] + hi[k] < 2^22; нормализуем 32 колонки в 16-битные лимбы
  L.push('  var c = 0u;');
  L.push('  var r: array<u32, 32>;');
  for (let k = 0; k < 32; k++) {
    const parts = [...lo[k], ...hi[k]];
    L.push(`  { let v = ${parts.length ? parts.join(' + ') : '0u'} + c; r[${k}] = v & 0xffffu; c = v >> 16u; }`);
  }
  // r[31] не превышает 16 бит: произведение < 2^510, перенос c = 0
  // 2^256 ≡ 38: складываем верхнюю половину, умноженную на 38, в нижнюю
  L.push('  var o: Fe;');
  for (let i = 0; i < 16; i++) L.push(`  o[${i}] = r[${i}] + 38u * r[${i + 16}];`);
  L.push('  fe_carry(&o);');
  L.push('  return o;');
  L.push('}');
  return L.join('\n');
}

export function feWgsl() {
  const mulTerms = [];
  for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) mulTerms.push([i, j, 1]);
  const sqTerms = [];
  for (let i = 0; i < 16; i++) for (let j = i; j < 16; j++) sqTerms.push([i, j, i === j ? 1 : 2]);
  return [
    body('fe_mul', 'a: Fe, b: Fe', (i, j) => `a${i} * b${j}`, mulTerms),
    body('fe_sq', 'a: Fe', (i, j) => `a${i} * a${j}`, sqTerms),
  ].join('\n\n');
}
