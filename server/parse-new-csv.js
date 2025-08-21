import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseNewCSV() {
  const csvPath = path.join(__dirname, '../attached_assets/SM_communication_lessons.xlsx - for test_1749725175598.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  
  // Split by lines and process
  const lines = csvContent.split('\n');
  const lessons = [];
  
  // Skip header and process each lesson
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Parse CSV line manually to handle quoted content with commas
    const fields = parseCSVLine(line);
    
    if (fields.length >= 4) {
      const lessonName = fields[0];
      const coverImage = fields[1];
      const description = fields[2];
      const lessonText = fields[3];
      
      // Only process if we have a proper lesson name
      if (lessonName && lessonName.length > 10 && coverImage.includes('.jpg')) {
        const lesson = {
          id: lessons.length + 1,
          title: lessonName,
          coverImage: coverImage,
          description: cleanText(description),
          pages: parseContentIntoPages(lessonText)
        };
        
        lessons.push(lesson);
        console.log(`Parsed lesson ${lessons.length}: ${lessonName}`);
      }
    }
  }
  
  return lessons;
}

function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add the last field
  fields.push(current.trim());
  return fields;
}

function parseContentIntoPages(content) {
  const cleanContent = cleanText(content);
  
  // Split by major sections marked with ##
  const sections = cleanContent.split(/(?=## [A-Z])/);
  
  const pages = [];
  let introContent = '';
  let stepContent = '';
  let reflectContent = '';
  
  sections.forEach(section => {
    const trimmed = section.trim();
    if (!trimmed) return;
    
    if (trimmed.includes('## What You Need to Know') || 
        trimmed.includes('## Understanding') ||
        trimmed.includes('## The Foundation') ||
        trimmed.includes('## The Three Pillars') ||
        trimmed.includes('## The Challenge')) {
      introContent = trimmed;
    } else if (trimmed.includes('## Step-by-Step Guide') ||
               trimmed.includes('## Breaking the Ice') ||
               trimmed.includes('## Building') ||
               trimmed.includes('## Crafting') ||
               trimmed.includes('## Mastering')) {
      stepContent = trimmed;
    } else if (trimmed.includes('## Common Mistakes') ||
               trimmed.includes('## Reflect & Act') ||
               trimmed.includes('## Avoiding') ||
               trimmed.includes('## Mastering Conversation') ||
               trimmed.includes('## Q&A Mastery')) {
      reflectContent = trimmed;
    }
  });
  
  // Create 3-page structure
  pages.push({
    title: "Key Concepts",
    content: introContent || "## Key Concepts\nContent coming soon..."
  });
  
  pages.push({
    title: "Step-by-Step Guide", 
    content: stepContent || "## Step-by-Step Guide\nContent coming soon..."
  });
  
  pages.push({
    title: "Practice & Reflection",
    content: reflectContent || "## Practice & Reflection\nContent coming soon..."
  });
  
  return pages;
}

function cleanText(text) {
  return text
    .replace(/^"|"$/g, '') // Remove surrounding quotes
    .replace(/""/g, '"')   // Replace escaped quotes
    .replace(/\\n/g, '\n') // Replace literal \n with actual newlines
    .trim();
}

// Generate lessons
const lessons = parseNewCSV();
const courseData = { lessons };

// Write to file
const outputPath = path.join(__dirname, 'course-content-parsed.json');
fs.writeFileSync(outputPath, JSON.stringify(courseData, null, 2));

console.log(`\nGenerated ${lessons.length} lessons:`);
lessons.forEach((lesson, index) => {
  console.log(`${index + 1}. ${lesson.title}`);
  console.log(`   Cover: ${lesson.coverImage}`);
  console.log(`   Pages: ${lesson.pages.length}`);
  console.log(`   Description length: ${lesson.description.length} chars`);
});

export { parseNewCSV };