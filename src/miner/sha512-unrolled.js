// Генератор полностью развёрнутого SHA-512 для горячего цикла PBKDF2.
// Сообщение — ровно 64 байта после 128-байтного блока ключа HMAC (длина 1536 бит),
// поэтому слова 8..15 — константы. Все слова и состояние — отдельные переменные,
// без динамической индексации: компилятор держит их в регистрах.

const K512 = [
  '428a2f98d728ae22', '7137449123ef65cd', 'b5c0fbcfec4d3b2f', 'e9b5dba58189dbbc', '3956c25bf348b538',
  '59f111f1b605d019', '923f82a4af194f9b', 'ab1c5ed5da6d8118', 'd807aa98a3030242', '12835b0145706fbe',
  '243185be4ee4b28c', '550c7dc3d5ffb4e2', '72be5d74f27b896f', '80deb1fe3b1696b1', '9bdc06a725c71235',
  'c19bf174cf692694', 'e49b69c19ef14ad2', 'efbe4786384f25e3', '0fc19dc68b8cd5b5', '240ca1cc77ac9c65',
  '2de92c6f592b0275', '4a7484aa6ea6e483', '5cb0a9dcbd41fbd4', '76f988da831153b5', '983e5152ee66dfab',
  'a831c66d2db43210', 'b00327c898fb213f', 'bf597fc7beef0ee4', 'c6e00bf33da88fc2', 'd5a79147930aa725',
  '06ca6351e003826f', '142929670a0e6e70', '27b70a8546d22ffc', '2e1b21385c26c926', '4d2c6dfc5ac42aed',
  '53380d139d95b3df', '650a73548baf63de', '766a0abb3c77b2a8', '81c2c92e47edaee6', '92722c851482353b',
  'a2bfe8a14cf10364', 'a81a664bbc423001', 'c24b8b70d0f89791', 'c76c51a30654be30', 'd192e819d6ef5218',
  'd69906245565a910', 'f40e35855771202a', '106aa07032bbd1b8', '19a4c116b8d2d0c8', '1e376c085141ab53',
  '2748774cdf8eeb99', '34b0bcb5e19b48a8', '391c0cb3c5c95a63', '4ed8aa4ae3418acb', '5b9cca4f7763e373',
  '682e6ff3d6b2b8a3', '748f82ee5defb2fc', '78a5636f43172f60', '84c87814a1f0ab72', '8cc702081a6439ec',
  '90befffa23631e28', 'a4506cebde82bde9', 'bef9a3f7b2c67915', 'c67178f2e372532b', 'ca273eceea26619c',
  'd186b8c721c0c207', 'eada7dd6cde0eb1e', 'f57d4f7fee6ed178', '06f067aa72176fba', '0a637dc5a2c898a6',
  '113f9804bef90dae', '1b710b35131c471b', '28db77f523047d84', '32caab7b40c72493', '3c9ebe0a15c9bebc',
  '431d67c49c100d4c', '4cc5d4becb3e42b6', '597f299cfc657e2a', '5fcb6fab3ad6faec', '6c44198c4a475817',
];

const v2 = (hex) => `vec2<u32>(0x${hex.slice(0, 8)}u, 0x${hex.slice(8)}u)`;

export function sha512M64Wgsl() {
  const L = [];
  L.push('fn sha512_m64(st: array<vec2<u32>, 8>, m: array<vec2<u32>, 8>) -> array<vec2<u32>, 8> {');
  for (let i = 0; i < 8; i++) L.push(`  var w${i} = m[${i}];`);
  L.push('  var w8 = vec2<u32>(0x80000000u, 0u);');
  for (let i = 9; i < 15; i++) L.push(`  var w${i} = vec2<u32>(0u, 0u);`);
  L.push('  var w15 = vec2<u32>(0u, 1536u);');
  for (let i = 0; i < 8; i++) L.push(`  var s${i} = st[${i}];`);
  const s = (k, i) => `s${(((k - i) % 8) + 8) % 8}`;
  for (let i = 0; i < 80; i++) {
    const a = s(0, i), b = s(1, i), c = s(2, i), d = s(3, i);
    const e = s(4, i), f = s(5, i), g = s(6, i), h = s(7, i);
    const wi = `w${i % 16}`;
    if (i >= 16) {
      const w15 = `w${(i - 15) % 16}`;
      const w2 = `w${(i - 2) % 16}`;
      const w7 = `w${(i - 7) % 16}`;
      L.push(
        `  ${wi} = add64(add64(${wi}, rotr(${w15}, 1u) ^ rotr(${w15}, 8u) ^ shr(${w15}, 7u)), add64(${w7}, rotr(${w2}, 19u) ^ rotrh(${w2}, 61u) ^ shr(${w2}, 6u)));`,
      );
    }
    L.push(
      `  { let t1 = add64(add64(${h}, rotr(${e}, 14u) ^ rotr(${e}, 18u) ^ rotrh(${e}, 41u)), add64(add64(${g} ^ (${e} & (${f} ^ ${g})), ${v2(K512[i])}), ${wi}));` +
        ` let t2 = add64(rotr(${a}, 28u) ^ rotrh(${a}, 34u) ^ rotrh(${a}, 39u), (${a} & ${b}) | (${c} & (${a} | ${b})));` +
        ` ${d} = add64(${d}, t1); ${h} = add64(t1, t2); }`,
    );
  }
  L.push(
    '  return array<vec2<u32>, 8>(' +
      Array.from({ length: 8 }, (_, i) => `add64(st[${i}], s${i})`).join(', ') +
      ');',
  );
  L.push('}');
  return L.join('\n');
}
