interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const renderMarkdown = (text: string) => {
    // Pre-process to handle code blocks and inline code
    let processed = text
      // Handle inline code first (before other formatting)
      .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono">$1</code>')
      // Handle code blocks
      .replace(/```[\s\S]*?```/g, (match) => {
        const code = match.replace(/```/g, '');
        return `<pre class="bg-gray-100 p-3 rounded-lg my-4 overflow-x-auto"><code class="font-mono text-sm">${code.trim()}</code></pre>`;
      });

    // Split into lines for better list processing
    const lines = processed.split('\n');
    const result: string[] = [];
    let inList = false;
    let inOrderedList = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const nextLine = lines[i + 1];
      
      // Handle unordered lists
      if (line.match(/^- (.+)/)) {
        if (!inList) {
          result.push('<ul class="space-y-2 my-4 pl-2">');
          inList = true;
        }
        const content = line.replace(/^- (.+)/, '$1');
        result.push(`<li class="flex items-start"><span class="mr-2 mt-2 w-1 h-1 bg-gray-600 rounded-full flex-shrink-0"></span><span>${content}</span></li>`);
        
        // Close list if next line is not a list item
        if (!nextLine || !nextLine.match(/^- /)) {
          result.push('</ul>');
          inList = false;
        }
      }
      // Handle ordered lists
      else if (line.match(/^(\d+)\. (.+)/)) {
        if (!inOrderedList) {
          result.push('<ol class="space-y-2 my-4 pl-2">');
          inOrderedList = true;
        }
        const match = line.match(/^(\d+)\. (.+)/);
        if (match) {
          const [, num, content] = match;
          result.push(`<li class="flex items-start"><span class="mr-3 font-medium text-gray-700 flex-shrink-0">${num}.</span><span>${content}</span></li>`);
        }
        
        // Close list if next line is not a list item
        if (!nextLine || !nextLine.match(/^\d+\. /)) {
          result.push('</ol>');
          inOrderedList = false;
        }
      }
      // Handle other content
      else {
        // Close any open lists
        if (inList) {
          result.push('</ul>');
          inList = false;
        }
        if (inOrderedList) {
          result.push('</ol>');
          inOrderedList = false;
        }
        
        // Process headers, bold, italic, etc.
        let processedLine = line
          // Headers with better spacing and hierarchy
          .replace(/^#### (.+)$/g, '<h4 class="text-base font-medium text-gray-800 mt-4 mb-2">$1</h4>')
          .replace(/^### (.+)$/g, '<h3 class="text-lg font-semibold text-gray-900 mt-5 mb-3">$1</h3>')
          .replace(/^## (.+)$/g, '<h2 class="text-xl font-bold text-gray-900 mt-6 mb-4">$1</h2>')
          .replace(/^# (.+)$/g, '<h1 class="text-2xl font-bold text-gray-900 mt-6 mb-4">$1</h1>')
          // Bold and italic (avoiding already processed code)
          .replace(/\*\*((?:(?!\*\*|<code|<\/code>).)+)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>')
          .replace(/\*((?:(?!\*|<code|<\/code>).)+)\*/g, '<em class="italic text-gray-800">$1</em>')
          // Handle images
          .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="w-full rounded-lg my-4" />');
        
        // Only add paragraphs for non-empty, non-header lines
        if (processedLine.trim() && !processedLine.match(/^<h[1-6]/) && !processedLine.match(/^<img/) && !processedLine.match(/^<pre/)) {
          processedLine = `<p class="mb-4 text-gray-700 leading-relaxed text-base">${processedLine}</p>`;
        }
        
        if (processedLine.trim()) {
          result.push(processedLine);
        }
      }
    }
    
    // Close any remaining open lists
    if (inList) result.push('</ul>');
    if (inOrderedList) result.push('</ol>');
    
    return result.join('\n').replace(/<p[^>]*>\s*<\/p>/g, '');
  };

  return (
    <div 
      className="markdown-content"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
    />
  );
}
