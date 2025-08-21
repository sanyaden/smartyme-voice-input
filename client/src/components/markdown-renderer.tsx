interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const renderMarkdown = (text: string) => {
    return text
      // Handle images first
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="w-full rounded-lg my-4" />')
      // Headers with better spacing and hierarchy
      .replace(/^#### (.+)$/gm, '<h4 class="text-base font-medium text-gray-800 mt-4 mb-2">$1</h4>')
      .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-gray-900 mt-5 mb-3">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-gray-900 mt-6 mb-4">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-gray-900 mt-6 mb-4">$1</h1>')
      // Bold and italic with better contrast
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic text-gray-800">$1</em>')
      // Unordered lists
      .replace(/^- (.+)$/gm, '<li class="flex items-start"><span class="mr-2 mt-2 w-1 h-1 bg-gray-600 rounded-full flex-shrink-0"></span><span>$1</span></li>')
      // Numbered lists
      .replace(/^(\d+)\. (.+)$/gm, '<li class="flex items-start"><span class="mr-3 font-medium text-gray-700 flex-shrink-0">$1.</span><span>$2</span></li>')
      .replace(/(<li class="flex.*?<\/li>\s*)+/g, (match) => `<ul class="space-y-2 my-4 pl-2">${match}</ul>`)
      // Remove standalone hash characters
      .replace(/^#\s*$/gm, '')
      .replace(/^\s*#\s*$/gm, '')
      // Paragraphs with better spacing and readability
      .replace(/\n\s*\n/g, '</p><p class="mb-4 text-gray-700 leading-relaxed text-base">')
      .replace(/^/, '<p class="mb-4 text-gray-700 leading-relaxed text-base">')
      .replace(/$/, '</p>')
      // Clean up
      .replace(/<p[^>]*>\s*<\/p>/g, '')
      .replace(/<p[^>]*>(<h[23])/g, '$1')
      .replace(/(<\/h[23]>)<\/p>/g, '$1')
      .replace(/<p[^>]*>(<ul)/g, '$1')
      .replace(/(<\/ul>)<\/p>/g, '$1')
      .replace(/<p[^>]*>(<ol)/g, '$1')
      .replace(/(<\/ol>)<\/p>/g, '$1')
      .replace(/<p[^>]*>(<img)/g, '$1')
      .replace(/(<\/img>)<\/p>/g, '$1')
      // Final cleanup of empty elements
      .replace(/<p[^>]*>\s*<\/p>/g, '');
  };

  return (
    <div 
      className="markdown-content"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
    />
  );
}
