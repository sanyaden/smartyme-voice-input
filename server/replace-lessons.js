import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { transformCsvToLessons } from './transform-csv-lessons.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function replaceLessons() {
  try {
    console.log('🔄 Starting lesson replacement process...');
    
    // Step 1: Load current lessons for comparison
    const currentPath = path.join(__dirname, 'course-content.json');
    const currentData = JSON.parse(fs.readFileSync(currentPath, 'utf-8'));
    console.log(`📚 Current: ${currentData.lessons.length} lessons`);
    
    // Step 2: Transform CSV to lesson format
    const csvResult = await transformCsvToLessons();
    console.log(`📈 New: ${csvResult.lessons.length} lessons`);
    console.log(`➕ Difference: ${csvResult.lessons.length - currentData.lessons.length} lessons`);
    
    // Step 3: Create new course content structure
    const newCourseContent = {
      lessons: csvResult.lessons
    };
    
    // Step 4: Validate structure matches current format
    const sampleCurrent = currentData.lessons[0];
    const sampleNew = newCourseContent.lessons[0];
    
    console.log('🔍 Structure validation:');
    const requiredFields = ['id', 'longId', 'courseId', 'title', 'description', 'coverImage', 'pages'];
    const validationResults = requiredFields.map(field => {
      const hasField = field in sampleNew;
      console.log(`  ${hasField ? '✅' : '❌'} ${field}: ${hasField ? 'Present' : 'Missing'}`);
      return hasField;
    });
    
    if (!validationResults.every(v => v)) {
      throw new Error('❌ Structure validation failed - missing required fields');
    }
    
    // Step 5: Additional content validation
    console.log('🔍 Content validation:');
    const contentChecks = [
      { name: 'All lessons have IDs', check: () => newCourseContent.lessons.every(l => l.id) },
      { name: 'All lessons have titles', check: () => newCourseContent.lessons.every(l => l.title) },
      { name: 'All lessons have content', check: () => newCourseContent.lessons.every(l => l.pages[0]?.content) },
      { name: 'CourseId is 8', check: () => newCourseContent.lessons.every(l => l.courseId === 8) },
      { name: 'IDs are numeric', check: () => newCourseContent.lessons.every(l => typeof l.id === 'number') }
    ];
    
    contentChecks.forEach(({ name, check }) => {
      const result = check();
      console.log(`  ${result ? '✅' : '❌'} ${name}`);
      if (!result) throw new Error(`❌ Content validation failed: ${name}`);
    });
    
    // Step 6: Create backup with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(__dirname, `course-content-backup-${timestamp}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(currentData, null, 2));
    console.log(`💾 Backup created: ${backupPath}`);
    
    // Step 7: Write new content
    const outputPath = path.join(__dirname, 'course-content.json');
    fs.writeFileSync(outputPath, JSON.stringify(newCourseContent, null, 2));
    console.log(`📝 New content written to: ${outputPath}`);
    
    // Step 8: Verify file was written correctly
    const verifyData = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
    if (verifyData.lessons.length !== csvResult.lessons.length) {
      throw new Error('❌ File write verification failed - lesson count mismatch');
    }
    
    console.log('🎉 Lesson replacement completed successfully!');
    console.log('📊 Summary:');
    console.log(`  • Replaced: ${currentData.lessons.length} → ${verifyData.lessons.length} lessons`);
    console.log(`  • ID range: ${csvResult.stats.minId} → ${csvResult.stats.maxId}`);
    console.log(`  • Categories: ${csvResult.stats.categories.length}`);
    console.log(`  • Backup: ${backupPath}`);
    
    return {
      success: true,
      oldCount: currentData.lessons.length,
      newCount: verifyData.lessons.length,
      backupPath,
      stats: csvResult.stats
    };
    
  } catch (error) {
    console.error('💥 Lesson replacement failed:', error.message);
    throw error;
  }
}

// If run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  replaceLessons()
    .then((result) => {
      console.log('✅ Process completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Process failed:', error.message);
      process.exit(1);
    });
}

export { replaceLessons };