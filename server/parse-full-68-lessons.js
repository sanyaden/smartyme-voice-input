/**
 * Full 68 Lessons CSV Parser for SmartyMe Platform
 * 
 * This parser processes the complete lessons CSV file with 68 lessons
 * and creates comprehensive lesson mappings and content for the system.
 */

import fs from 'fs';
import path from 'path';

function parseFullLessonsCSV() {
  console.log('🚀 Starting full 68 lessons CSV parsing...');
  
  // Try to find the CSV file with the most lessons
  const csvFiles = [
    'attached_assets/lessons_with_id - выгрузка с айди (1)_1751378844419.csv',
    'attached_assets/lessons_with_id - выгрузка с айди_1751373166278.csv',
    'attached_assets/new_lessons.csv'
  ];
  
  let csvPath = null;
  let csvContent = null;
  
  for (const filePath of csvFiles) {
    try {
      if (fs.existsSync(filePath)) {
        csvContent = fs.readFileSync(filePath, 'utf-8');
        csvPath = filePath;
        console.log(`✅ Found CSV file: ${filePath}`);
        break;
      }
    } catch (error) {
      console.log(`❌ Could not read ${filePath}:`, error.message);
    }
  }
  
  if (!csvContent) {
    console.error('❌ No valid CSV file found');
    return null;
  }
  
  console.log(`📊 Processing CSV: ${csvPath}`);
  console.log(`📄 File size: ${csvContent.length} characters`);
  
  // Parse CSV content
  const parsedLessons = parseCSVContent(csvContent);
  
  if (!parsedLessons || parsedLessons.length === 0) {
    console.error('❌ No lessons parsed from CSV');
    return null;
  }
  
  console.log(`✅ Successfully parsed ${parsedLessons.length} lessons`);
  
  // Generate outputs
  const outputs = {
    lessonMappings: generateLessonMappings(parsedLessons),
    courseContent: generateCourseContent(parsedLessons),
    lessonTitles: parsedLessons.map(lesson => ({
      id: lesson.id,
      longId: lesson.longId,
      title: lesson.title
    }))
  };
  
  // Save outputs to files
  saveParsedData(outputs);
  
  return outputs;
}

function parseCSVContent(csvContent) {
  const lines = csvContent.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    console.error('❌ CSV file has no data rows');
    return [];
  }
  
  // Parse header to understand structure
  const header = parseCSVLine(lines[0]);
  console.log('📋 CSV Header:', header);
  
  // Find column indices
  const idIndex = findColumnIndex(header, ['lesson_id_new', 'id', 'lesson_id']);
  const longIdIndex = findColumnIndex(header, ['lesson_id', 'long_id', 'lesson_long_id']);
  const titleIndex = findColumnIndex(header, ['title', 'lesson_title', 'name']);
  const contentIndex = findColumnIndex(header, ['content', 'lesson_content', 'description']);
  
  if (idIndex === -1 || longIdIndex === -1 || titleIndex === -1) {
    console.error('❌ Required columns not found in CSV');
    console.log('Available columns:', header);
    return [];
  }
  
  console.log(`📍 Column mapping - ID: ${idIndex}, Long ID: ${longIdIndex}, Title: ${titleIndex}, Content: ${contentIndex}`);
  
  const lessons = [];
  
  // Process each data row
  for (let i = 1; i < lines.length; i++) {
    try {
      const row = parseCSVLine(lines[i]);
      
      if (row.length <= Math.max(idIndex, longIdIndex, titleIndex)) {
        continue; // Skip incomplete rows
      }
      
      const lesson = createLessonFromCSVRow(row, {
        idIndex,
        longIdIndex, 
        titleIndex,
        contentIndex
      });
      
      if (lesson) {
        lessons.push(lesson);
      }
    } catch (error) {
      console.warn(`⚠️  Error parsing row ${i}: ${error.message}`);
    }
  }
  
  return lessons;
}

function findColumnIndex(header, possibleNames) {
  for (const name of possibleNames) {
    const index = header.findIndex(col => 
      col.toLowerCase().includes(name.toLowerCase())
    );
    if (index !== -1) {
      return index;
    }
  }
  return -1;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"' && (i === 0 || line[i-1] !== '\\')) {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result.map(field => field.replace(/^"|"$/g, ''));
}

function createLessonFromCSVRow(row, columnMapping) {
  const { idIndex, longIdIndex, titleIndex, contentIndex } = columnMapping;
  
  const id = parseInt(row[idIndex]);
  const longId = row[longIdIndex];
  const title = row[titleIndex];
  const content = contentIndex !== -1 ? row[contentIndex] : '';
  
  if (isNaN(id) || !longId || !title) {
    return null; // Skip invalid rows
  }
  
  return {
    id,
    longId: longId.trim(),
    title: cleanText(title),
    description: cleanText(content).substring(0, 500) + (content.length > 500 ? '...' : ''),
    content: cleanText(content),
    courseId: extractCourseId(longId),
    coverImage: generateCoverImageName(title)
  };
}

function extractCourseId(longId) {
  // Extract course topic from long ID
  const parts = longId.split('__');
  if (parts.length > 0) {
    const topic = parts[0].toLowerCase();
    
    // Map topics to course IDs
    if (topic.includes('communication') || topic.includes('say_no')) return 8;
    if (topic.includes('public_speaking')) return 9;
    if (topic.includes('leadership')) return 10;
    if (topic.includes('workplace')) return 11;
    if (topic.includes('relationship')) return 12;
  }
  
  return 1; // Default course ID
}

function cleanText(text) {
  if (!text) return '';
  
  return text
    .replace(/\\n/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .trim();
}

function generateCoverImageName(title) {
  return title
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '')
    .substring(0, 30) + '_cover.jpg';
}

function generateLessonMappings(lessons) {
  return lessons.map(lesson => ({
    shortId: lesson.id,
    longId: lesson.longId,
    title: lesson.title
  }));
}

function generateCourseContent(lessons) {
  return {
    lessons: lessons.map(lesson => ({
      id: lesson.id,
      longId: lesson.longId,
      courseId: lesson.courseId,
      title: lesson.title,
      description: lesson.description,
      coverImage: lesson.coverImage,
      pages: [
        {
          title: "Content",
          content: lesson.content
        }
      ]
    }))
  };
}

function saveParsedData(outputs) {
  try {
    // Save lesson mappings for client and server
    const mappingContent = `// Auto-generated lesson mappings from CSV (${new Date().toISOString()})
// Contains ${outputs.lessonMappings.length} lessons

export interface LessonMapping {
  shortId: number;
  longId: string;
  title: string;
}

export const LESSON_MAPPINGS: LessonMapping[] = ${JSON.stringify(outputs.lessonMappings, null, 2)};

/**
 * Convert long lesson ID to short ID for internal system use
 */
export function mapLongIdToShortId(longId: string): number | null {
  const decoded = decodeURIComponent(longId);
  
  // Try exact match first
  const exactMatch = LESSON_MAPPINGS.find(mapping => mapping.longId === decoded);
  if (exactMatch) {
    console.log("✅ SERVER: Found exact match:", exactMatch.shortId);
    return exactMatch.shortId;
  }
  
  // Try partial match
  const partialMatch = LESSON_MAPPINGS.find(mapping => 
    mapping.longId.includes(decoded) || decoded.includes(mapping.longId)
  );
  if (partialMatch) {
    console.log("✅ SERVER: Found partial match:", partialMatch.shortId);
    return partialMatch.shortId;
  }
  
  console.log("❌ SERVER: No mapping found for long ID:", decoded);
  return null;
}

export function mapShortIdToLongId(shortId: number): string | null {
  const mapping = LESSON_MAPPINGS.find(mapping => mapping.shortId === shortId);
  return mapping ? mapping.longId : null;
}

export function detectLessonIdFormat(lessonId: string): 'long' | 'short' | 'invalid' {
  if (/^\\d+$/.test(lessonId)) return 'short';
  if (lessonId.includes('_') || lessonId.length > 10) return 'long';
  return 'invalid';
}

export function resolveLessonId(lessonId: string): number | null {
  const format = detectLessonIdFormat(lessonId);
  
  if (format === 'short') {
    return parseInt(lessonId);
  } else if (format === 'long') {
    return mapLongIdToShortId(lessonId);
  }
  
  return null;
}
`;

    // Save server-side lesson mapping
    fs.writeFileSync('server/lesson-mapping.ts', mappingContent);
    console.log('✅ Saved server lesson mappings');
    
    // Save client-side lesson mapping  
    fs.writeFileSync('client/src/lib/lesson-mapping.ts', mappingContent);
    console.log('✅ Saved client lesson mappings');
    
    // Save course content
    fs.writeFileSync('server/course-content.json', JSON.stringify(outputs.courseContent, null, 2));
    console.log('✅ Saved course content JSON');
    
    // Save lesson summary for reference
    const summary = `# Lesson Summary (${new Date().toISOString()})

Total Lessons: ${outputs.lessonTitles.length}

## Lessons by ID:
${outputs.lessonTitles.map(lesson => `- ${lesson.id}: ${lesson.title}`).join('\n')}

## Sample Long IDs:
${outputs.lessonTitles.slice(0, 5).map(lesson => `- ${lesson.longId}`).join('\n')}
`;
    
    fs.writeFileSync('lesson-summary.md', summary);
    console.log('✅ Saved lesson summary');
    
  } catch (error) {
    console.error('❌ Error saving parsed data:', error);
  }
}

// Run the parser if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  parseFullLessonsCSV();
}

export { parseFullLessonsCSV };