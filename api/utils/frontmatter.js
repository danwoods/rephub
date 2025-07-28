/**
 * Parse frontmatter from markdown content
 * Supports both --- and +++ delimiters with TOML-style syntax
 */
function parseFrontmatter(content) {
  if (!content || typeof content !== 'string') {
    return { frontmatter: {}, content: content || '' };
  }

  // Check for frontmatter delimiters
  const yamlMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  const tomlMatch = content.match(/^\+\+\+\s*\n([\s\S]*?)\n\+\+\+\s*\n([\s\S]*)$/);
  
  let frontmatterString = '';
  let bodyContent = content;
  
  if (yamlMatch) {
    frontmatterString = yamlMatch[1];
    bodyContent = yamlMatch[2];
  } else if (tomlMatch) {
    frontmatterString = tomlMatch[1];
    bodyContent = tomlMatch[2];
  } else {
    // No frontmatter found
    return { frontmatter: {}, content: content };
  }

  // Parse the frontmatter
  const frontmatter = {};
  
  if (frontmatterString) {
    const lines = frontmatterString.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('#')) continue;
      
      // Handle TOML-style key = value pairs
      const match = trimmedLine.match(/^(\w+)\s*=\s*(.+)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        
        // Try to parse as number if it looks like one
        if (/^\d+$/.test(value)) {
          value = parseInt(value, 10);
        } else if (/^\d+\.\d+$/.test(value)) {
          value = parseFloat(value);
        }
        
        frontmatter[key] = value;
      }
    }
  }

  return {
    frontmatter,
    content: bodyContent.trim()
  };
}

module.exports = { parseFrontmatter }; 