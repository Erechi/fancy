// @ton/core рассчитан на Node и ждёт глобальный Buffer.
import { Buffer } from 'buffer';

globalThis.Buffer ??= Buffer;
