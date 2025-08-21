import fs from 'fs';
import csv from 'csv-parser';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function transformCsvToLessons() {
  return new Promise((resolve, reject) => {
    const lessons = [];
    const csvPath = path.join(__dirname, '..', 'attached_assets', 'SM_Lessons 20250730-13321 - SM_Lessons 20250730-13321_1753885146633.csv');
    
    console.log('🔄 Starting CSV transformation...');
    console.log('📁 Reading from:', csvPath);
    
    if (!fs.existsSync(csvPath)) {
      reject(new Error(`CSV file not found at: ${csvPath}`));
      return;
    }
    
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row) => {
        try {
          // Transform CSV row to lesson format
          const lesson = {
            id: parseInt(row.id),
            longId: row.legacy_id,
            courseId: 8, // Maintain current courseId structure
            title: row.title,
            description: row.description,
            coverImage: `lesson_${row.id}_cover.jpg`,
            pages: [
              {
                title: "Content",
                content: row.text
              }
            ]
          };
          
          // Validate required fields
          if (!lesson.id || !lesson.title || !lesson.description || !lesson.pages[0].content) {
            console.error('❌ Invalid lesson data for ID:', row.id);
            console.error('Missing fields:', {
              id: !lesson.id,
              title: !lesson.title,
              description: !lesson.description,
              content: !lesson.pages[0].content
            });
            return;
          }
          
          lessons.push(lesson);
          
        } catch (error) {
          console.error('❌ Error processing row:', row.id, error.message);
        }
      })
      .on('end', () => {
        console.log('✅ CSV parsing completed');
        console.log(`📊 Processed ${lessons.length} lessons`);
        
        // Sort lessons by ID to maintain order
        lessons.sort((a, b) => a.id - b.id);
        
        // Validate lesson continuity
        const ids = lessons.map(l => l.id);
        const minId = Math.min(...ids);
        const maxId = Math.max(...ids);
        
        console.log(`📈 ID range: ${minId} to ${maxId}`);
        console.log(`🔍 Sample lessons:`, lessons.slice(0, 3).map(l => ({ id: l.id, title: l.title })));
        
        resolve({
          lessons: lessons,
          stats: {
            total: lessons.length,
            minId,
            maxId,
            categories: [...new Set(lessons.map(l => l.longId.split('__')[1]?.replace(/_/g, ' ') || 'Unknown'))]
          }
        });
      })
      .on('error', (error) => {
        console.error('❌ CSV parsing error:', error);
        reject(error);
      });
  });
}

export { transformCsvToLessons };

// If run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  transformCsvToLessons()
    .then((result) => {
      console.log('🎉 Transformation completed successfully');
      console.log('📊 Stats:', result.stats);
      console.log('📂 Categories found:', result.stats.categories.length);
      result.stats.categories.forEach(cat => console.log(`  - ${cat}`));
    })
    .catch((error) => {
      console.error('💥 Transformation failed:', error.message);
      process.exit(1);
    });
}