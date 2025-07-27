import MarkdownIt from 'markdown-it';
import markdownItChords from 'markdown-it-chords';
import { parse as parseToml } from 'toml';

// Initialize markdown-it with chords plugin
const md = new MarkdownIt({
  html: true,
  breaks: true,
  linkify: true
}).use(markdownItChords);

export function parseMarkdownWithFrontmatter(content) {
  if (!content || typeof content !== 'string') {
    console.error('Invalid content provided to parseMarkdownWithFrontmatter');
    return {
      frontmatter: {},
      content: content || '',
      html: ''
    };
  }

  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (match) {
    try {
      const frontmatter = parseToml(match[1]);
      const markdownContent = match[2];
      const html = md.render(markdownContent);
      
      return {
        frontmatter: frontmatter || {},
        content: markdownContent,
        html
      };
    } catch (error) {
      console.error('Error parsing TOML frontmatter:', error);
      console.error('Frontmatter content that failed:', match[1]);
      // Fallback: treat entire content as markdown
      const html = md.render(content);
      return {
        frontmatter: {},
        content,
        html
      };
    }
  } else {
    // No frontmatter found, treat entire content as markdown
    try {
      const html = md.render(content);
      return {
        frontmatter: {},
        content,
        html
      };
    } catch (error) {
      console.error('Error rendering markdown:', error);
      return {
        frontmatter: {},
        content,
        html: content // Return content as-is if markdown rendering fails
      };
    }
  }
}

export function renderMarkdown(content) {
  try {
    return md.render(content);
  } catch (error) {
    console.error('Error rendering markdown:', error);
    return content; // Return content as-is if rendering fails
  }
} 