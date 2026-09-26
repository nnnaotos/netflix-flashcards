import { describe, it, expect } from 'vitest';
import {
  normalizePhrase,
  normalizeExample,
  normalizeShow,
  CaptureInputError,
} from './capture';

describe('normalizePhrase', () => {
  it('字幕の改行を空白に畳む', () => {
    expect(normalizePhrase("You're getting\ncold feet")).toBe("You're getting cold feet");
  });

  it('連続する空白を1つにする', () => {
    expect(normalizePhrase('cold    feet')).toBe('cold feet');
  });

  it('前後の空白を落とす', () => {
    expect(normalizePhrase('  cold feet  ')).toBe('cold feet');
  });

  it('空白だけならエラー', () => {
    expect(() => normalizePhrase('   ')).toThrow(CaptureInputError);
  });

  it('200文字は通る', () => {
    const s = 'a'.repeat(200);
    expect(normalizePhrase(s)).toBe(s);
  });

  it('201文字はエラー', () => {
    expect(() => normalizePhrase('a'.repeat(201))).toThrow(CaptureInputError);
  });

  it('文字列以外はエラー', () => {
    expect(() => normalizePhrase(42)).toThrow(CaptureInputError);
    expect(() => normalizePhrase(undefined)).toThrow(CaptureInputError);
  });
});

describe('normalizeExample', () => {
  it('未指定は空文字', () => {
    expect(normalizeExample(undefined)).toBe('');
    expect(normalizeExample(null)).toBe('');
  });

  it('改行を畳む', () => {
    expect(normalizeExample('one\ntwo')).toBe('one two');
  });

  it('1000文字は通り、1001文字はエラー', () => {
    expect(normalizeExample('a'.repeat(1000))).toHaveLength(1000);
    expect(() => normalizeExample('a'.repeat(1001))).toThrow(CaptureInputError);
  });

  it('文字列以外はエラー', () => {
    expect(() => normalizeExample(42)).toThrow(CaptureInputError);
  });
});

describe('normalizeShow', () => {
  it('英語タイトルを既存の作品名に寄せる', () => {
    expect(normalizeShow('Prison Break')).toBe('プリズンブレイク');
  });

  it('大文字小文字を問わない', () => {
    expect(normalizeShow('prison break')).toBe('プリズンブレイク');
    expect(normalizeShow('SUITS')).toBe('SUITS');
    expect(normalizeShow('suits')).toBe('SUITS');
  });

  it('エイリアスにない作品名はそのまま返す', () => {
    expect(normalizeShow('Breaking Bad')).toBe('Breaking Bad');
  });

  it('未指定・空はnull', () => {
    expect(normalizeShow(undefined)).toBeNull();
    expect(normalizeShow('')).toBeNull();
    expect(normalizeShow('   ')).toBeNull();
  });

  it('64文字は通り、65文字はnull', () => {
    expect(normalizeShow('a'.repeat(64))).toHaveLength(64);
    expect(normalizeShow('a'.repeat(65))).toBeNull();
  });

  it('文字列以外はnull', () => {
    expect(normalizeShow(42)).toBeNull();
  });
});
