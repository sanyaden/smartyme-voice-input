import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseFullCSVLessons() {
  try {
    // Read the new CSV file with all 68 lessons
    const csvPath = path.join(__dirname, '..', 'attached_assets', 'new_lessons.csv');
    
    if (!fs.existsSync(csvPath)) {
      console.error('CSV file not found:', csvPath);
      return null;
    }
    
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lessons = parseCSVContent(csvContent);
    
    console.log(`Parsed ${lessons.length} lessons from CSV`);
    
    // Create the course content structure
    const courseContent = {
      lessons: lessons
    };
    
    // Save to course-content.json
    const outputPath = path.join(__dirname, 'course-content.json');
    fs.writeFileSync(outputPath, JSON.stringify(courseContent, null, 2));
    console.log(`Saved ${lessons.length} lessons to course-content.json`);
    
    return courseContent;
    
  } catch (error) {
    console.error('Error parsing CSV lessons:', error);
    return null;
  }
}

function parseCSVContent(csvContent) {
  const lines = csvContent.trim().split('\n');
  const lessons = [];
  
  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    try {
      const parsedLine = parseCSVLine(line);
      if (parsedLine) {
        const lesson = createLessonFromCSVData(parsedLine);
        if (lesson) {
          lessons.push(lesson);
        }
      }
    } catch (error) {
      console.error(`Error parsing line ${i + 1}:`, error.message);
      continue;
    }
  }
  
  return lessons;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  let i = 0;
  
  while (i < line.length) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Handle escaped quotes
        current += '"';
        i += 2;
        continue;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
    i++;
  }
  
  // Add the last field
  result.push(current);
  
  // Expected format: course_id_new,lesson_id_new,lesson_id,title,description,text
  if (result.length >= 6) {
    return {
      course_id_new: result[0],
      lesson_id_new: result[1],
      lesson_id: result[2],
      title: result[3],
      description: result[4],
      text: result[5]
    };
  }
  
  return null;
}

function createLessonFromCSVData(csvData) {
  try {
    const courseId = parseInt(csvData.course_id_new);
    const shortId = parseInt(csvData.lesson_id_new);
    const longId = csvData.lesson_id;
    const title = cleanText(csvData.title);
    const description = cleanText(csvData.description);
    const text = cleanText(csvData.text);
    
    if (!shortId || !longId || !title) {
      console.warn('Skipping lesson with missing required data:', { shortId, longId, title });
      return null;
    }
    
    // Create lesson pages from the text content
    const pages = parseContentIntoPages(text, title);
    
    // Generate cover image name
    const coverImage = generateCoverImageName(title);
    
    return {
      id: shortId,                    // Numeric ID for internal system (169, 170, 171...)
      longId: longId,                 // Long string ID for mobile app URLs
      courseId: courseId,             // Course ID (8)
      title: title,
      description: description,
      coverImage: coverImage,
      pages: pages
    };
    
  } catch (error) {
    console.error('Error creating lesson from CSV data:', error);
    return null;
  }
}

function parseContentIntoPages(content, title) {
  if (!content) return [];
  
  const pages = [];
  
  // Split content by ## headings
  const sections = content.split(/##\s+/);
  
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i].trim();
    if (!section) continue;
    
    // First section might not have a heading
    if (i === 0 && !section.startsWith('#')) {
      pages.push({
        title: "Introduction",
        content: cleanText(section)
      });
      continue;
    }
    
    // Find the title (first line)
    const lines = section.split('\n');
    const pageTitle = lines[0].trim();
    const pageContent = lines.slice(1).join('\n').trim();
    
    if (pageTitle && pageContent) {
      pages.push({
        title: cleanText(pageTitle),
        content: cleanText(pageContent)
      });
    }
  }
  
  // If no pages were created, create a single page with all content
  if (pages.length === 0) {
    pages.push({
      title: "Content",
      content: cleanText(content)
    });
  }
  
  return pages;
}

function cleanText(text) {
  if (!text) return '';
  
  return text
    // Remove image markdown
    .replace(/!\[.*?\]\(.*?\)/g, '')
    // Remove excessive quotes
    .replace(/"{2,}/g, '"')
    // Remove markdown formatting but keep structure
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    // Clean up whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function generateCoverImageName(title) {
  // Generate a cover image filename based on the title
  const cleanTitle = title
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '')
    .slice(0, 30);
  
  return `${cleanTitle}_cover.jpg`;
}

// Export the main function
export { parseFullCSVLessons };

// If run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  parseFullCSVLessons();
}