// Полный конвейер майнинга на GPU, один кандидат на поток:
//   энтропия 128 бит → 12 слов BIP39 → PBKDF2-HMAC-SHA512 (2048) → SLIP-10 m/44'/607'/0'
//   → ed25519 публичный ключ → stateInit WalletTg → адрес → сравнение с шаблоном.
// 64-битная арифметика SHA-512 эмулируется парами u32: x = старшие 32 бита, y = младшие.

struct Params {
  base: vec4<u32>,      // случайная энтропия от CPU, своя на каждый запуск
  subwallet: u32,
  flag: u32,            // 0x51 (UQ…) или 0xd1 (testnet, 0Q…)
  patLen: u32,          // число проверяемых символов (начало + конец), до 16
  mode: u32,            // 0 — майнинг, 1 — отладка (пишем промежуточные значения)
  count: u32,           // число кандидатов в этом запуске
  p0: u32,
  p1: u32,
  p2: u32,
  patPos: array<vec4<u32>, 4>, // индекс символа в 48-символьном адресе
  patA: array<vec4<u32>, 4>,   // допустимый 6-битный символ для позиции
  patB: array<vec4<u32>, 4>,   // второй допустимый (другой регистр) или тот же
}

struct Out {
  count: atomic<u32>,
  pad0: u32,
  pad1: u32,
  pad2: u32,
  results: array<u32>,  // по 4 слова энтропии на находку
}

@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<uniform> K512: array<vec4<u32>, 80>;  // .xy = K[i]
@group(0) @binding(2) var<uniform> K256: array<vec4<u32>, 16>;
@group(0) @binding(3) var<storage, read> WORDS: array<u32>;      // [len, bytes0..3, bytes4..7] × 2048
@group(0) @binding(4) var<storage, read> TABLE: array<u32>;      // ed25519 fixed-base, 64×16×3 Fe по 8 u32
@group(0) @binding(5) var<storage, read_write> OUT: Out;
@group(0) @binding(6) var<storage, read_write> DBG: array<u32>;

const MAX_RESULTS: u32 = 64u;
// Первые 40 байт представления stateInit: [2, 1, 0x34, 0,0,0,0, codeHash(32), …] как BE-слова.
// codeHash трамплина = 9149ae51…feeca768 (проверено против @ton/core в test/derive.test.js).
const SI_PREFIX = array<u32, 10>(
  0x02013400u, 0x00000091u, 0x49ae51c1u, 0xe4689710u, 0xcebf7830u,
  0x297b16acu, 0xfbadb363u, 0xa920a537u, 0x893e7ffeu, 0xeca76800u);

// ---------------- SHA-512 ----------------

fn add64(a: vec2<u32>, b: vec2<u32>) -> vec2<u32> {
  let lo = a.y + b.y;
  return vec2<u32>(a.x + b.x + select(0u, 1u, lo < a.y), lo);
}
// 0 < n < 32
fn rotr(a: vec2<u32>, n: u32) -> vec2<u32> {
  return vec2<u32>((a.x >> n) | (a.y << (32u - n)), (a.y >> n) | (a.x << (32u - n)));
}
// 32 < n < 64
fn rotrh(a: vec2<u32>, n: u32) -> vec2<u32> {
  let m = n - 32u;
  return vec2<u32>((a.y >> m) | (a.x << (32u - m)), (a.x >> m) | (a.y << (32u - m)));
}
fn shr(a: vec2<u32>, n: u32) -> vec2<u32> {
  return vec2<u32>(a.x >> n, (a.y >> n) | (a.x << (32u - n)));
}

fn k512(i: u32) -> vec2<u32> {
  return K512[i].xy;
}

fn sha512_block(st: ptr<function, array<vec2<u32>, 8>>, w: ptr<function, array<vec2<u32>, 16>>) {
  var a = (*st)[0]; var b = (*st)[1]; var c = (*st)[2]; var d = (*st)[3];
  var e = (*st)[4]; var f = (*st)[5]; var g = (*st)[6]; var h = (*st)[7];
  for (var i = 0u; i < 80u; i++) {
    var wi: vec2<u32>;
    if (i < 16u) {
      wi = (*w)[i];
    } else {
      let w15 = (*w)[(i + 1u) & 15u];
      let w2 = (*w)[(i + 14u) & 15u];
      let s0 = rotr(w15, 1u) ^ rotr(w15, 8u) ^ shr(w15, 7u);
      let s1 = rotr(w2, 19u) ^ rotrh(w2, 61u) ^ shr(w2, 6u);
      wi = add64(add64((*w)[i & 15u], s0), add64((*w)[(i + 9u) & 15u], s1));
      (*w)[i & 15u] = wi;
    }
    let S1 = rotr(e, 14u) ^ rotr(e, 18u) ^ rotrh(e, 41u);
    let ch = (e & f) ^ (~e & g);
    let t1 = add64(add64(h, S1), add64(add64(ch, k512(i)), wi));
    let S0 = rotr(a, 28u) ^ rotrh(a, 34u) ^ rotrh(a, 39u);
    let mj = (a & b) ^ (a & c) ^ (b & c);
    h = g; g = f; f = e; e = add64(d, t1);
    d = c; c = b; b = a; a = add64(t1, add64(S0, mj));
  }
  (*st)[0] = add64((*st)[0], a); (*st)[1] = add64((*st)[1], b);
  (*st)[2] = add64((*st)[2], c); (*st)[3] = add64((*st)[3], d);
  (*st)[4] = add64((*st)[4], e); (*st)[5] = add64((*st)[5], f);
  (*st)[6] = add64((*st)[6], g); (*st)[7] = add64((*st)[7], h);
}

fn sha512_iv() -> array<vec2<u32>, 8> {
  return array<vec2<u32>, 8>(
    vec2<u32>(0x6a09e667u, 0xf3bcc908u), vec2<u32>(0xbb67ae85u, 0x84caa73bu),
    vec2<u32>(0x3c6ef372u, 0xfe94f82bu), vec2<u32>(0xa54ff53au, 0x5f1d36f1u),
    vec2<u32>(0x510e527fu, 0xade682d1u), vec2<u32>(0x9b05688cu, 0x2b3e6c1fu),
    vec2<u32>(0x1f83d9abu, 0xfb41bd6bu), vec2<u32>(0x5be0cd19u, 0x137e2179u));
}

// HMAC: состояния после блока ключа (K0 ^ ipad) и (K0 ^ opad). key — 32 BE-слова (128 байт).
fn hmac_init(key: ptr<function, array<u32, 32>>, ist: ptr<function, array<vec2<u32>, 8>>, ost: ptr<function, array<vec2<u32>, 8>>) {
  var w: array<vec2<u32>, 16>;
  *ist = sha512_iv();
  for (var i = 0u; i < 16u; i++) {
    w[i] = vec2<u32>((*key)[2u * i] ^ 0x36363636u, (*key)[2u * i + 1u] ^ 0x36363636u);
  }
  sha512_block(ist, &w);
  *ost = sha512_iv();
  for (var i = 0u; i < 16u; i++) {
    w[i] = vec2<u32>((*key)[2u * i] ^ 0x5c5c5c5cu, (*key)[2u * i + 1u] ^ 0x5c5c5c5cu);
  }
  sha512_block(ost, &w);
}

// HMAC от 64-байтного сообщения (8 слов): 192 байта всего → длина 1536 бит.
fn hmac64(ist: ptr<function, array<vec2<u32>, 8>>, ost: ptr<function, array<vec2<u32>, 8>>, msg: ptr<function, array<vec2<u32>, 8>>) -> array<vec2<u32>, 8> {
  // sha512_m64 — развёрнутый вариант, генерируется в sha512-unrolled.js и дописывается к шейдеру
  return sha512_m64(*ost, sha512_m64(*ist, *msg));
}

fn put_byte(buf: ptr<function, array<u32, 32>>, pos: u32, b: u32) {
  (*buf)[pos >> 2u] |= (b & 0xffu) << (24u - 8u * (pos & 3u));
}

// ---------------- SHA-256 ----------------

fn rotr32(x: u32, n: u32) -> u32 { return (x >> n) | (x << (32u - n)); }

fn k256(i: u32) -> u32 { return K256[i >> 2u][i & 3u]; }

fn sha256_block(st: ptr<function, array<u32, 8>>, w: ptr<function, array<u32, 16>>) {
  var a = (*st)[0]; var b = (*st)[1]; var c = (*st)[2]; var d = (*st)[3];
  var e = (*st)[4]; var f = (*st)[5]; var g = (*st)[6]; var h = (*st)[7];
  for (var i = 0u; i < 64u; i++) {
    var wi: u32;
    if (i < 16u) {
      wi = (*w)[i];
    } else {
      let w15 = (*w)[(i + 1u) & 15u];
      let w2 = (*w)[(i + 14u) & 15u];
      let s0 = rotr32(w15, 7u) ^ rotr32(w15, 18u) ^ (w15 >> 3u);
      let s1 = rotr32(w2, 17u) ^ rotr32(w2, 19u) ^ (w2 >> 10u);
      wi = (*w)[i & 15u] + s0 + (*w)[(i + 9u) & 15u] + s1;
      (*w)[i & 15u] = wi;
    }
    let S1 = rotr32(e, 6u) ^ rotr32(e, 11u) ^ rotr32(e, 25u);
    let ch = (e & f) ^ (~e & g);
    let t1 = h + S1 + ch + k256(i) + wi;
    let S0 = rotr32(a, 2u) ^ rotr32(a, 13u) ^ rotr32(a, 22u);
    let mj = (a & b) ^ (a & c) ^ (b & c);
    h = g; g = f; f = e; e = d + t1;
    d = c; c = b; b = a; a = t1 + S0 + mj;
  }
  (*st)[0] += a; (*st)[1] += b; (*st)[2] += c; (*st)[3] += d;
  (*st)[4] += e; (*st)[5] += f; (*st)[6] += g; (*st)[7] += h;
}

fn sha256_iv() -> array<u32, 8> {
  return array<u32, 8>(0x6a09e667u, 0xbb67ae85u, 0x3c6ef372u, 0xa54ff53au,
                       0x510e527fu, 0x9b05688cu, 0x1f83d9abu, 0x5be0cd19u);
}

// ---------------- Поле GF(2^255 - 19): 16 лимбов по 16 бит ----------------

alias Fe = array<u32, 16>;

fn fe_carry(o: ptr<function, Fe>) {
  var c = 0u;
  for (var i = 0u; i < 16u; i++) {
    let v = (*o)[i] + c;
    (*o)[i] = v & 0xffffu;
    c = v >> 16u;
  }
  // 2^256 ≡ 38 (mod p)
  (*o)[0] += 38u * c;
  c = 0u;
  for (var i = 0u; i < 16u; i++) {
    let v = (*o)[i] + c;
    (*o)[i] = v & 0xffffu;
    c = v >> 16u;
  }
  (*o)[0] += 38u * c;
}

fn fe_mul(a: Fe, b: Fe) -> Fe {
  var r: array<u32, 32>;
  var clo = 0u;
  var chi = 0u;
  for (var k = 0u; k < 31u; k++) {
    var lo = clo;
    var hi = chi;
    let i0 = select(0u, k - 15u, k > 15u);
    let i1 = min(k, 15u);
    for (var i = i0; i <= i1; i++) {
      let p = a[i] * b[k - i];
      lo += p;
      hi += select(0u, 1u, lo < p);
    }
    r[k] = lo & 0xffffu;
    clo = (lo >> 16u) | (hi << 16u);
    chi = hi >> 16u;
  }
  r[31] = clo;
  var o: Fe;
  for (var i = 0u; i < 16u; i++) {
    o[i] = r[i] + 38u * r[i + 16u];
  }
  fe_carry(&o);
  return o;
}

fn fe_sq(a: Fe) -> Fe { return fe_mul(a, a); }

fn fe_sqn(a: Fe, n: u32) -> Fe {
  var t = a;
  for (var i = 0u; i < n; i++) { t = fe_mul(t, t); }
  return t;
}

fn fe_add(a: Fe, b: Fe) -> Fe {
  var o: Fe;
  for (var i = 0u; i < 16u; i++) { o[i] = a[i] + b[i]; }
  fe_carry(&o);
  return o;
}

// a - b; при уходе в минус результат «обёрнут» на 2^256 ≡ 38, поэтому вычитаем 38 ещё раз.
fn fe_sub(a: Fe, b: Fe) -> Fe {
  var o: Fe;
  var br = 0u;
  for (var i = 0u; i < 16u; i++) {
    let t = a[i] + 0x10000u - b[i] - br;
    o[i] = t & 0xffffu;
    br = 1u - (t >> 16u);
  }
  for (var ps = 0u; ps < 2u; ps++) {
    var sb = 38u * br;
    br = 0u;
    for (var i = 0u; i < 16u; i++) {
      let t = o[i] + 0x10000u - sb - br;
      o[i] = t & 0xffffu;
      br = 1u - (t >> 16u);
      sb = 0u;
    }
  }
  return o;
}

// Полное приведение в [0, p).
fn fe_canon(a: Fe) -> Fe {
  var v = a;
  for (var ps = 0u; ps < 2u; ps++) {
    var t: Fe;
    var c = 19u;
    for (var i = 0u; i < 16u; i++) {
      let s = v[i] + c;
      t[i] = s & 0xffffu;
      c = s >> 16u;
    }
    // если v + 19 ≥ 2^255, то v ≥ p и v - p = (v + 19) - 2^255
    if (c != 0u) {
      t[15] |= 0x8000u; // v + 19 = 2^256 + t → v - p = t + 2^255
      v = t;
    } else if ((t[15] & 0x8000u) != 0u) {
      t[15] &= 0x7fffu;
      v = t;
    }
  }
  return v;
}

fn fe_inv(z: Fe) -> Fe {
  let z2 = fe_sq(z);
  let z8 = fe_sqn(z2, 2u);
  let z9 = fe_mul(z8, z);
  let z11 = fe_mul(z9, z2);
  let z22 = fe_sq(z11);
  let z_5_0 = fe_mul(z22, z9);
  let z_10_0 = fe_mul(fe_sqn(z_5_0, 5u), z_5_0);
  let z_20_0 = fe_mul(fe_sqn(z_10_0, 10u), z_10_0);
  let z_40_0 = fe_mul(fe_sqn(z_20_0, 20u), z_20_0);
  let z_50_0 = fe_mul(fe_sqn(z_40_0, 10u), z_10_0);
  let z_100_0 = fe_mul(fe_sqn(z_50_0, 50u), z_50_0);
  let z_200_0 = fe_mul(fe_sqn(z_100_0, 100u), z_100_0);
  let z_250_0 = fe_mul(fe_sqn(z_200_0, 50u), z_50_0);
  return fe_mul(fe_sqn(z_250_0, 5u), z11);
}

fn load_fe(off: u32) -> Fe {
  var o: Fe;
  for (var i = 0u; i < 8u; i++) {
    let v = TABLE[off + i];
    o[2u * i] = v & 0xffffu;
    o[2u * i + 1u] = v >> 16u;
  }
  return o;
}

// ---------------- Основной конвейер ----------------

fn word_bits(w: ptr<function, array<u32, 5>>, off: u32) -> u32 {
  let i = off >> 5u;
  let s = off & 31u;
  var v = (*w)[i] << s;
  if (s != 0u) { v |= (*w)[i + 1u] >> (32u - s); }
  return v >> 21u;
}

@compute @workgroup_size(WG)
fn main(@builtin(global_invocation_id) gid3: vec3<u32>, @builtin(num_workgroups) nwg: vec3<u32>) {
  let gid = gid3.x + gid3.y * nwg.x * WG;
  if (gid >= P.count) { return; }

  // --- энтропия и чек-сумма BIP39 ---
  let e0 = P.base.x;
  let e1 = P.base.y;
  let e2 = P.base.z;
  let e3 = P.base.w ^ gid;
  var h256 = sha256_iv();
  var w32: array<u32, 16>;
  w32[0] = e0; w32[1] = e1; w32[2] = e2; w32[3] = e3; w32[4] = 0x80000000u;
  w32[15] = 128u;
  sha256_block(&h256, &w32);
  var ent = array<u32, 5>(e0, e1, e2, e3, h256[0] & 0xf0000000u);

  // --- фраза «w1 w2 … w12» как ключ HMAC (≤ 128 байт, дополнение нулями) ---
  var key: array<u32, 32>;
  var pos = 0u;
  for (var k = 0u; k < 12u; k++) {
    let idx = word_bits(&ent, 11u * k);
    if (k > 0u) { put_byte(&key, pos, 0x20u); pos++; }
    let len = WORDS[idx * 3u];
    let b0 = WORDS[idx * 3u + 1u];
    let b1 = WORDS[idx * 3u + 2u];
    for (var c = 0u; c < len; c++) {
      var ch: u32;
      if (c < 4u) { ch = b0 >> (24u - 8u * c); } else { ch = b1 >> (24u - 8u * (c - 4u)); }
      put_byte(&key, pos, ch);
      pos++;
    }
  }

  // --- PBKDF2-HMAC-SHA512, соль "mnemonic", 2048 итераций ---
  var ist: array<vec2<u32>, 8>;
  var ost: array<vec2<u32>, 8>;
  hmac_init(&key, &ist, &ost);

  var w: array<vec2<u32>, 16>;
  var s = ist;
  w[0] = vec2<u32>(0x6d6e656du, 0x6f6e6963u); // "mnemonic"
  w[1] = vec2<u32>(0x00000001u, 0x80000000u); // INT(1) + 0x80
  for (var i = 2u; i < 15u; i++) { w[i] = vec2<u32>(0u, 0u); }
  w[15] = vec2<u32>(0u, 1120u);               // (128 + 12) * 8
  sha512_block(&s, &w);
  var o = ost;
  for (var i = 0u; i < 8u; i++) { w[i] = s[i]; }
  w[8] = vec2<u32>(0x80000000u, 0u);
  for (var i = 9u; i < 15u; i++) { w[i] = vec2<u32>(0u, 0u); }
  w[15] = vec2<u32>(0u, 1536u);
  sha512_block(&o, &w);

  var u = o;
  var t = o;
  for (var it = 1u; it < 2048u; it++) {
    u = hmac64(&ist, &ost, &u);
    for (var i = 0u; i < 8u; i++) { t[i] = t[i] ^ u[i]; }
  }

  // --- SLIP-10: мастер-ключ HMAC("ed25519 seed", seed) ---
  var mk: array<u32, 32>;
  mk[0] = 0x65643235u; mk[1] = 0x35313920u; mk[2] = 0x73656564u; // "ed25519 seed"
  hmac_init(&mk, &ist, &ost);
  var I = hmac64(&ist, &ost, &t);

  // --- три усиленных шага: 44', 607', 0' ---
  for (var lvl = 0u; lvl < 3u; lvl++) {
    var idx = 0x80000000u;
    if (lvl == 0u) { idx = 0x8000002cu; } else if (lvl == 1u) { idx = 0x8000025fu; }
    var ck: array<u32, 32>;
    for (var i = 0u; i < 4u; i++) { ck[2u * i] = I[4u + i].x; ck[2u * i + 1u] = I[4u + i].y; }
    hmac_init(&ck, &ist, &ost);
    // данные: 0x00 || key(32) || index(4) = 37 байт, длина (128 + 37) * 8 = 1320 бит
    var kw: array<u32, 8>;
    for (var i = 0u; i < 4u; i++) { kw[2u * i] = I[i].x; kw[2u * i + 1u] = I[i].y; }
    var m: array<u32, 32>;
    m[0] = kw[0] >> 8u;
    for (var j = 1u; j < 8u; j++) { m[j] = (kw[j - 1u] << 24u) | (kw[j] >> 8u); }
    m[8] = (kw[7] << 24u) | (idx >> 8u);
    m[9] = (idx << 24u) | 0x00800000u;
    m[31] = 1320u;
    var sx = ist;
    for (var i = 0u; i < 16u; i++) { w[i] = vec2<u32>(m[2u * i], m[2u * i + 1u]); }
    sha512_block(&sx, &w);
    var ox = ost;
    for (var i = 0u; i < 8u; i++) { w[i] = sx[i]; }
    w[8] = vec2<u32>(0x80000000u, 0u);
    for (var i = 9u; i < 15u; i++) { w[i] = vec2<u32>(0u, 0u); }
    w[15] = vec2<u32>(0u, 1536u);
    sha512_block(&ox, &w);
    I = ox;
  }

  // --- ed25519: h = SHA512(priv), скаляр = clamp(h[0..32]) ---
  var hs = sha512_iv();
  for (var i = 0u; i < 4u; i++) { w[i] = I[i]; }
  w[4] = vec2<u32>(0x80000000u, 0u);
  for (var i = 5u; i < 15u; i++) { w[i] = vec2<u32>(0u, 0u); }
  w[15] = vec2<u32>(0u, 256u);
  sha512_block(&hs, &w);
  var sc: array<u32, 32>; // байты скаляра (little-endian число)
  for (var i = 0u; i < 4u; i++) {
    let hi = hs[i].x;
    let lo = hs[i].y;
    sc[8u * i + 0u] = hi >> 24u; sc[8u * i + 1u] = (hi >> 16u) & 0xffu;
    sc[8u * i + 2u] = (hi >> 8u) & 0xffu; sc[8u * i + 3u] = hi & 0xffu;
    sc[8u * i + 4u] = lo >> 24u; sc[8u * i + 5u] = (lo >> 16u) & 0xffu;
    sc[8u * i + 6u] = (lo >> 8u) & 0xffu; sc[8u * i + 7u] = lo & 0xffu;
  }
  sc[0] &= 248u;
  sc[31] = (sc[31] & 127u) | 64u;

  // A = Σ nibble_i · 16^i · B по таблице (y+x, y−x, 2dxy); нулевой полубайт = нейтральный элемент
  var X: Fe; var Y: Fe; var Z: Fe; var T: Fe;
  Y[0] = 1u; Z[0] = 1u;
  for (var i = 0u; i < 64u; i++) {
    let bv = sc[i >> 1u];
    let nib = select(bv & 15u, bv >> 4u, (i & 1u) == 1u);
    let off = ((i * 16u + nib) * 3u) * 8u;
    let ypx = load_fe(off);
    let ymx = load_fe(off + 8u);
    let xy2d = load_fe(off + 16u);
    let A = fe_mul(fe_sub(Y, X), ymx);
    let B = fe_mul(fe_add(Y, X), ypx);
    let C = fe_mul(T, xy2d);
    let D = fe_add(Z, Z);
    let E = fe_sub(B, A);
    let F = fe_sub(D, C);
    let G = fe_add(D, C);
    let H = fe_add(B, A);
    X = fe_mul(E, F);
    Y = fe_mul(G, H);
    T = fe_mul(E, H);
    Z = fe_mul(F, G);
  }
  let zi = fe_inv(Z);
  let ax = fe_canon(fe_mul(X, zi));
  let ay = fe_canon(fe_mul(Y, zi));
  var pk: array<u32, 32>;
  for (var i = 0u; i < 16u; i++) {
    pk[2u * i] = ay[i] & 0xffu;
    pk[2u * i + 1u] = ay[i] >> 8u;
  }
  pk[31] |= (ax[0] & 1u) << 7u;

  // --- хеш data-ячейки: [0x00, 82, rev 0x00, seqno 0×4, subwallet(4), pk(32)] = 43 байта ---
  var blk: array<u32, 32>;
  var hd = sha256_iv();
  blk[0] = 0x00520000u;
  blk[1] = P.subwallet >> 24u;
  blk[2] = (P.subwallet << 8u) | pk[0];
  for (var j = 0u; j < 7u; j++) {
    blk[3u + j] = (pk[1u + 4u * j] << 24u) | (pk[2u + 4u * j] << 16u) | (pk[3u + 4u * j] << 8u) | pk[4u + 4u * j];
  }
  blk[10] = (pk[29] << 24u) | (pk[30] << 16u) | (pk[31] << 8u) | 0x80u;
  for (var i = 0u; i < 16u; i++) { w32[i] = blk[i]; }
  w32[15] = 344u;
  sha256_block(&hd, &w32);

  // --- хеш stateInit: [2, 1, 0x34, 0,0,0,0, codeHash(32), dataHash(32)] = 71 байт ---
  var hi = sha256_iv();
  // байты 0..38 постоянны (заголовок + хеш кода трамплина); хеш data начинается с 39-го байта
  for (var j = 0u; j < 9u; j++) { w32[j] = SI_PREFIX[j]; }
  w32[9] = SI_PREFIX[9] | (hd[0] >> 24u);
  for (var j = 1u; j < 7u; j++) { w32[9u + j] = (hd[j - 1u] << 8u) | (hd[j] >> 24u); }
  sha256_block(&hi, &w32);
  w32[0] = (hd[6] << 8u) | (hd[7] >> 24u);
  w32[1] = (hd[7] << 8u) | 0x80u;
  for (var j = 2u; j < 15u; j++) { w32[j] = 0u; }
  w32[15] = 568u;
  sha256_block(&hi, &w32);

  // --- адрес: [flag, 0x00, hash(32), crc16(2)] → base64url ---
  var ab: array<u32, 36>;
  ab[0] = P.flag;
  ab[1] = 0u;
  for (var j = 0u; j < 8u; j++) {
    ab[2u + 4u * j] = hi[j] >> 24u;
    ab[3u + 4u * j] = (hi[j] >> 16u) & 0xffu;
    ab[4u + 4u * j] = (hi[j] >> 8u) & 0xffu;
    ab[5u + 4u * j] = hi[j] & 0xffu;
  }
  var crc = 0u;
  for (var j = 0u; j < 34u; j++) {
    crc ^= ab[j] << 8u;
    for (var b = 0u; b < 8u; b++) {
      if ((crc & 0x8000u) != 0u) { crc = ((crc << 1u) ^ 0x1021u) & 0xffffu; } else { crc = (crc << 1u) & 0xffffu; }
    }
  }
  ab[34] = crc >> 8u;
  ab[35] = crc & 0xffu;

  // один «живой» кандидат на запуск — для экрана поиска («последний кандидат»)
  if (gid == 0u) {
    for (var j = 0u; j < 9u; j++) {
      OUT.results[MAX_RESULTS * 4u + j] = (ab[4u * j] << 24u) | (ab[4u * j + 1u] << 16u) | (ab[4u * j + 2u] << 8u) | ab[4u * j + 3u];
    }
  }

  if (P.mode == 1u) {
    let base = gid * 40u;
    for (var i = 0u; i < 8u; i++) { DBG[base + 2u * i] = t[i].x; DBG[base + 2u * i + 1u] = t[i].y; }
    for (var i = 0u; i < 4u; i++) { DBG[base + 16u + 2u * i] = I[i].x; DBG[base + 17u + 2u * i] = I[i].y; }
    for (var i = 0u; i < 8u; i++) {
      DBG[base + 24u + i] = pk[4u * i] | (pk[4u * i + 1u] << 8u) | (pk[4u * i + 2u] << 16u) | (pk[4u * i + 3u] << 24u);
    }
    for (var i = 0u; i < 8u; i++) { DBG[base + 32u + i] = hi[i]; }
  }

  for (var p = 0u; p < P.patLen; p++) {
    let ci = P.patPos[p >> 2u][p & 3u];
    let g = (ci >> 2u) * 3u;
    let n = (ab[g] << 16u) | (ab[g + 1u] << 8u) | ab[g + 2u];
    let sx = (n >> (18u - 6u * (ci & 3u))) & 63u;
    if (sx != P.patA[p >> 2u][p & 3u] && sx != P.patB[p >> 2u][p & 3u]) { return; }
  }

  let slot = atomicAdd(&OUT.count, 1u);
  if (slot < MAX_RESULTS) {
    OUT.results[slot * 4u] = e0;
    OUT.results[slot * 4u + 1u] = e1;
    OUT.results[slot * 4u + 2u] = e2;
    OUT.results[slot * 4u + 3u] = e3;
  }
}
