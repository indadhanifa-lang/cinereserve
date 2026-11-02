import { describe, expect, it } from 'vitest';
import { youtubeId } from './youtube';

describe('youtubeId', () => {
  it('reads the id from every common YouTube link shape', () => {
    expect(youtubeId('https://www.youtube.com/watch?v=bKGxHflevuk&t=10s')).toBe('bKGxHflevuk');
    expect(youtubeId('https://youtu.be/bKGxHflevuk?si=abc')).toBe('bKGxHflevuk');
    expect(youtubeId('https://m.youtube.com/watch?v=bKGxHflevuk')).toBe('bKGxHflevuk');
    expect(youtubeId('https://www.youtube.com/embed/bKGxHflevuk')).toBe('bKGxHflevuk');
    expect(youtubeId('https://youtube.com/shorts/bKGxHflevuk')).toBe('bKGxHflevuk');
  });

  it('rejects other sites and malformed ids', () => {
    expect(youtubeId('https://vimeo.com/123456789')).toBeNull();
    expect(youtubeId('https://evil.com/watch?v=bKGxHflevuk')).toBeNull();
    expect(youtubeId('https://www.youtube.com/watch?v=bad"id')).toBeNull();
    expect(youtubeId('not a url')).toBeNull();
  });
});
