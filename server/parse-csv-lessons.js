import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseCSVLessons() {
  const csvPath = path.join(__dirname, '../attached_assets/SM_communication_lessons_for_test_1749724976511.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  
  const lines = csvContent.split('\n');
  const lessons = [];
  
  let currentLesson = null;
  let contentBuffer = '';
  let isInsideQuotes = false;
  
  for (let i = 1; i < lines.length; i++) { // Skip header
    const line = lines[i];
    
    if (!line.trim()) continue;
    
    // Check if this starts a new lesson (starts with lesson name and has .jpg)
    if (line.includes('.jpg') && !isInsideQuotes) {
      // Save previous lesson if exists
      if (currentLesson) {
        currentLesson.content = parseContentIntoPages(contentBuffer.trim());
        lessons.push(currentLesson);
      }
      
      // Parse new lesson
      const parts = line.split(',');
      if (parts.length >= 4) {
        const lessonName = parts[0].replace(/"/g, '').trim();
        const coverImage = parts[1].replace(/"/g, '').trim();
        const description = parts[2].replace(/^"|"$/g, '').trim();
        
        currentLesson = {
          id: lessons.length + 1,
          title: lessonName,
          coverImage: coverImage,
          description: description,
          content: []
        };
        
        // Start collecting content from the 4th column
        contentBuffer = parts.slice(3).join(',').replace(/^"|"$/g, '');
      }
    } else {
      // Continue collecting content for current lesson
      contentBuffer += '\n' + line;
    }
  }
  
  // Add the last lesson
  if (currentLesson) {
    currentLesson.content = parseContentIntoPages(contentBuffer.trim());
    lessons.push(currentLesson);
  }
  
  return lessons;
}

function parseContentIntoPages(content) {
  // Split content into 3 logical pages based on ## headers
  const sections = content.split(/(?=## )/);
  const pages = [];
  
  let introPage = null;
  let mainPage = null;
  let reflectPage = null;
  
  sections.forEach(section => {
    const trimmed = section.trim();
    if (!trimmed) return;
    
    if (trimmed.includes('## What You Need to Know') || trimmed.includes('## Understanding')) {
      mainPage = {
        title: "What You Need to Know",
        content: trimmed
      };
    } else if (trimmed.includes('## Step-by-Step Guide')) {
      if (!mainPage) {
        mainPage = {
          title: "Step-by-Step Guide", 
          content: trimmed
        };
      } else {
        // Append to main page
        mainPage.content += '\n\n' + trimmed;
      }
    } else if (trimmed.includes('## Reflect & Act') || trimmed.includes('## Common Mistakes')) {
      reflectPage = {
        title: "Reflect & Act",
        content: trimmed
      };
    } else if (trimmed.includes('## Common Mistakes') || trimmed.includes('## Common Pitfalls')) {
      if (reflectPage) {
        reflectPage.content = trimmed + '\n\n' + reflectPage.content;
      } else {
        reflectPage = {
          title: "Common Mistakes & Reflection",
          content: trimmed
        };
      }
    }
  });
  
  // Create 3 pages structure
  if (!mainPage) {
    mainPage = { title: "Key Concepts", content: "Content coming soon..." };
  }
  if (!reflectPage) {
    reflectPage = { title: "Practice & Reflection", content: "Content coming soon..." };
  }
  
  return [
    { title: "Key Concepts", content: mainPage.content },
    { title: "Step-by-Step Guide", content: sections.find(s => s.includes('## Step-by-Step'))?.trim() || "Guide coming soon..." },
    { title: "Practice & Reflection", content: reflectPage.content }
  ];
}

// Generate new course content
const lessons = parseCSVLessons();
const courseData = { lessons };

// Write to new course content file
const outputPath = path.join(__dirname, 'course-content-new.json');
fs.writeFileSync(outputPath, JSON.stringify(courseData, null, 2));

console.log(`Generated ${lessons.length} lessons:`);
lessons.forEach((lesson, index) => {
  console.log(`${index + 1}. ${lesson.title}`);
  console.log(`   Cover: ${lesson.coverImage}`);
  console.log(`   Pages: ${lesson.content.length}`);
});

export { parseCSVLessons };