import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  let i = 0;
  
  while (i < line.length) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 2;
        continue;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
      i++;
      continue;
    } else {
      current += char;
    }
    i++;
  }
  
  fields.push(current);
  return fields;
}

function parseTextIntoSections(text) {
  if (!text) return [];
  
  text = text.replace(/^"|"$/g, '').trim();
  const sections = [];
  const parts = text.split(/(?=^## )/m);
  
  parts.forEach((part, index) => {
    part = part.trim();
    if (!part || part === '#' || part === '##') return; // Skip empty or standalone hash sections
    
    const lines = part.split('\n');
    let title = '';
    let content = part;
    
    if (lines[0].startsWith('## ')) {
      title = lines[0].replace('## ', '').trim();
      content = lines.slice(1).join('\n').trim();
    }
    
    // Skip sections with no meaningful content
    if (!content || content === '#' || content.trim().length < 3) return;
    
    sections.push({
      id: sections.length + 1,
      title: title || `Section ${sections.length + 1}`,
      content: content
    });
  });
  
  return sections;
}

function parseCourseContent() {
  const csvPath = path.join(__dirname, '../attached_assets/SM_communication_lessons.xlsx - for_proto_1749650933838.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  
  // Use a more sophisticated CSV parser that handles quoted multiline fields
  const records = [];
  let inQuotes = false;
  let currentRecord = [];
  let currentField = '';
  let i = 0;
  
  // Skip header line
  while (i < csvContent.length && csvContent[i] !== '\n') {
    i++;
  }
  i++; // Skip the newline
  
  while (i < csvContent.length) {
    const char = csvContent[i];
    
    if (char === '"') {
      if (inQuotes && csvContent[i + 1] === '"') {
        // Escaped quote
        currentField += '"';
        i += 2;
        continue;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      currentRecord.push(currentField);
      currentField = '';
    } else if (char === '\n' && !inQuotes) {
      // Record separator
      currentRecord.push(currentField);
      if (currentRecord.length >= 4 && currentRecord[0] && currentRecord[1]) {
        records.push([...currentRecord]);
      }
      currentRecord = [];
      currentField = '';
    } else {
      currentField += char;
    }
    i++;
  }
  
  // Add final record if exists
  if (currentField || currentRecord.length > 0) {
    currentRecord.push(currentField);
    if (currentRecord.length >= 4 && currentRecord[0] && currentRecord[1]) {
      records.push(currentRecord);
    }
  }
  
  const categories = new Map();
  const lessons = [];
  
  records.forEach((record, index) => {
    const [categoryTitle, lessonTitle, description, text] = record;
    
    const cleanCategory = categoryTitle.trim();
    const cleanTitle = lessonTitle.trim();
    const cleanDescription = description.trim();
    const cleanText = text ? text.trim() : '';
    
    if (!categories.has(cleanCategory)) {
      categories.set(cleanCategory, {
        id: categories.size + 1,
        title: cleanCategory,
        lessons: []
      });
    }
    
    const lesson = {
      id: lessons.length + 1,
      categoryTitle: cleanCategory,
      title: cleanTitle,
      description: cleanDescription,
      sections: parseTextIntoSections(cleanText),
      order: index + 1
    };
    
    lessons.push(lesson);
    categories.get(cleanCategory).lessons.push(lesson);
  });
  
  return {
    categories: Array.from(categories.values()),
    lessons: lessons,
    totalLessons: lessons.length
  };
}

try {
  const courseData = parseCourseContent();
  const outputPath = path.join(__dirname, 'course-content.json');
  fs.writeFileSync(outputPath, JSON.stringify(courseData, null, 2));
  
  console.log(`Parsed ${courseData.categories.length} categories with ${courseData.totalLessons} lessons`);
  courseData.categories.forEach(cat => {
    console.log(`${cat.title}: ${cat.lessons.length} lessons`);
  });
  
} catch (error) {
  console.error('Error parsing course content:', error);
}