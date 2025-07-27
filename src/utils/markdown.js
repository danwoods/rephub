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

  // More flexible regex that handles different line endings and spacing
  const frontmatterRegex = /^---\s*[\r\n]+([\s\S]*?)[\r\n]+---\s*[\r\n]+([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  console.log('Content starts with:', content.substring(0, 200));
  console.log('Frontmatter match:', match ? 'Found' : 'Not found');

  if (match) {
    console.log('Frontmatter content:', match[1]);
    try {
      const frontmatter = parseToml(match[1]);
      console.log('Parsed frontmatter:', frontmatter);
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
    console.log('No frontmatter found, treating entire content as markdown');
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