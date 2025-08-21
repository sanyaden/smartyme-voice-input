// Lesson ID mapping utilities

export function resolveLessonId(lessonId: string | number): string {
  // Convert numeric IDs to string format
  if (typeof lessonId === 'number') {
    return lessonId.toString();
  }
  return lessonId;
}

export function detectLessonIdFormat(lessonId: string): 'numeric' | 'long-form' {
  // Check if the lesson ID is numeric or long-form
  if (/^\d+$/.test(lessonId)) {
    return 'numeric';
  }
  return 'long-form';
}

export function mapLongIdToShortId(longId: string): string {
  // Map long-form IDs to short numeric IDs
  // This is a placeholder - implement actual mapping based on your needs
  
  // For now, return a hash-based numeric ID
  let hash = 0;
  for (let i = 0; i < longId.length; i++) {
    const char = longId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString();
}

export function mapShortIdToLongId(shortId: string): string | null {
  // Map short numeric IDs to long-form IDs
  // This would require a lookup table or database query
  // For now, return null to indicate mapping not available
  return null;
}