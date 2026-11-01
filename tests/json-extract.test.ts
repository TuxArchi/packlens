import { describe, expect, it } from 'vitest';
import { extractJsonObject } from '../src/core/json-extract';

describe('extractJsonObject', () => {
  it('extracts a nested object', () => {
    const source = 'var ytInitialPlayerResponse = {"a":{"b":1},"c":"d"};var other = 1;';
    expect(extractJsonObject(source, 'ytInitialPlayerResponse')).toEqual({
      a: { b: 1 },
      c: 'd',
    });
  });

  it('ignores braces inside strings and escaped quotes', () => {
    const source = String.raw`var ytInitialPlayerResponse = {"a":"} not the end \" {","b":[1,2]};`;
    expect(extractJsonObject(source, 'ytInitialPlayerResponse')).toEqual({
      a: '} not the end " {',
      b: [1, 2],
    });
  });

  it('returns null when the marker is missing', () => {
    expect(extractJsonObject('var something = {};', 'ytInitialPlayerResponse')).toBeNull();
  });

  it('returns null when the object is truncated', () => {
    const source = 'var ytInitialPlayerResponse = {"a":{"b":1}';
    expect(extractJsonObject(source, 'ytInitialPlayerResponse')).toBeNull();
  });

  it('returns null when the content is not valid JSON', () => {
    const source = 'var ytInitialPlayerResponse = {notJson: true};';
    expect(extractJsonObject(source, 'ytInitialPlayerResponse')).toBeNull();
  });
});
