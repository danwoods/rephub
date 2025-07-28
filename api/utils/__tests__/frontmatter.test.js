const { parseFrontmatter } = require('../frontmatter');

describe('Frontmatter Parser', () => {
  describe('YAML-style frontmatter', () => {
    it('should parse YAML frontmatter with TOML syntax', () => {
      const content = `---
title = "Keep On Rockin' in the Free World"
bpm = 130
key = "Em"
---

[Intro]
Em D C Em D C`;

      const result = parseFrontmatter(content);
      
      expect(result.frontmatter).toEqual({
        title: "Keep On Rockin' in the Free World",
        bpm: 130,
        key: "Em"
      });
      
      expect(result.content).toBe(`[Intro]
Em D C Em D C`);
    });

    it('should handle numeric values correctly', () => {
      const content = `---
bpm = 120
tempo = 95.5
duration = 180
---

Song content`;

      const result = parseFrontmatter(content);
      
      expect(result.frontmatter.bpm).toBe(120);
      expect(result.frontmatter.tempo).toBe(95.5);
      expect(result.frontmatter.duration).toBe(180);
    });

    it('should handle quoted strings', () => {
      const content = `---
title = "Amazing Grace"
key = 'G'
artist = "Traditional"
---

Song content`;

      const result = parseFrontmatter(content);
      
      expect(result.frontmatter.title).toBe("Amazing Grace");
      expect(result.frontmatter.key).toBe("G");
      expect(result.frontmatter.artist).toBe("Traditional");
    });
  });

  describe('TOML-style frontmatter', () => {
    it('should parse TOML frontmatter with +++ delimiters', () => {
      const content = `+++
title = "House of the Rising Sun"
key = "Am"
bpm = 110
+++

# House of the Rising Sun

## Verse 1
There [Am]is a [C]house`;

      const result = parseFrontmatter(content);
      
      expect(result.frontmatter).toEqual({
        title: "House of the Rising Sun",
        key: "Am",
        bpm: 110
      });
      
      expect(result.content).toBe(`# House of the Rising Sun

## Verse 1
There [Am]is a [C]house`);
    });
  });

  describe('Edge cases', () => {
    it('should handle content without frontmatter', () => {
      const content = `[Verse 1]
This is just content without frontmatter`;

      const result = parseFrontmatter(content);
      
      expect(result.frontmatter).toEqual({});
      expect(result.content).toBe(content);
    });

    it('should handle empty content', () => {
      const result = parseFrontmatter('');
      
      expect(result.frontmatter).toEqual({});
      expect(result.content).toBe('');
    });

    it('should handle null/undefined content', () => {
      const result1 = parseFrontmatter(null);
      const result2 = parseFrontmatter(undefined);
      
      expect(result1.frontmatter).toEqual({});
      expect(result1.content).toBe('');
      expect(result2.frontmatter).toEqual({});
      expect(result2.content).toBe('');
    });

    it('should skip comment lines in frontmatter', () => {
      const content = `---
# This is a comment
title = "Test Song"
# Another comment
key = "G"
---

Song content`;

      const result = parseFrontmatter(content);
      
      expect(result.frontmatter).toEqual({
        title: "Test Song",
        key: "G"
      });
    });

    it('should handle frontmatter with no content after', () => {
      const content = `---
title = "Test Song"
key = "G"
---`;

      const result = parseFrontmatter(content);
      
      expect(result.frontmatter).toEqual({
        title: "Test Song",
        key: "G"
      });
      expect(result.content).toBe('');
    });
  });
}); 