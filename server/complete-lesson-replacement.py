#!/usr/bin/env python3
"""
Complete lesson system replacement from CSV.
Replaces all existing lessons with exact CSV data using original IDs.
"""
import csv
import json
import re
from datetime import datetime

def clean_text(text):
    """Clean and prepare text content for JSON storage."""
    if not text:
        return ""
    
    # Fix escaped quotes properly
    text = text.replace('""', '"')
    
    # Clean up extra whitespace but preserve markdown formatting
    lines = text.split('\n')
    cleaned_lines = []
    for line in lines:
        cleaned_lines.append(line.rstrip())
    
    return '\n'.join(cleaned_lines)

def create_backup():
    """Create backup of current system."""
    try:
        with open('server/course-content.json', 'r', encoding='utf-8') as f:
            current_data = f.read()
        
        backup_filename = f'server/course-content-backup-{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
        with open(backup_filename, 'w', encoding='utf-8') as f:
            f.write(current_data)
        
        print(f"✅ Created backup: {backup_filename}")
        return True
    except Exception as e:
        print(f"⚠️  Could not create backup: {e}")
        return False

def parse_csv_lessons(csv_file_path):
    """Parse lessons from CSV file with robust handling."""
    lessons = []
    lesson_mappings = []
    
    print(f"📖 Processing lessons from: {csv_file_path}")
    
    with open(csv_file_path, 'r', encoding='utf-8') as file:
        csv_reader = csv.DictReader(file)
        
        processed_count = 0
        skipped_count = 0
        
        for row in csv_reader:
            try:
                lesson_id_new = int(row['lesson_id_new'])
                lesson_id = row['lesson_id'].strip()
                title = clean_text(row['title'])
                description = clean_text(row['description'])
                text = clean_text(row['text'])
                
                # Skip if essential data is missing
                if not lesson_id or not title:
                    print(f"⚠️  Skipping lesson {lesson_id_new}: Missing essential data")
                    skipped_count += 1
                    continue
                
                # Truncate description if too long (for consistency)
                if len(description) > 300:
                    description = description[:297] + "..."
                
                # Create lesson object with exact CSV ID
                lesson = {
                    "id": lesson_id_new,  # Use exact CSV ID
                    "longId": lesson_id,
                    "courseId": 8,  # Keep consistent with existing system
                    "title": title,
                    "description": description,
                    "coverImage": f"lesson_{lesson_id_new}_cover.jpg",
                    "pages": [
                        {
                            "title": "Content",
                            "content": text
                        }
                    ]
                }
                
                lessons.append(lesson)
                
                # Create mapping entry
                mapping = {
                    "shortId": lesson_id_new,
                    "longId": lesson_id,
                    "title": title
                }
                lesson_mappings.append(mapping)
                
                processed_count += 1
                
            except Exception as e:
                print(f"❌ Error processing row: {e}")
                skipped_count += 1
    
    print(f"✅ Processed {processed_count} lessons, skipped {skipped_count}")
    
    # Sort lessons by ID for consistency
    lessons.sort(key=lambda x: x['id'])
    lesson_mappings.sort(key=lambda x: x['shortId'])
    
    return lessons, lesson_mappings

def save_course_content(lessons, output_file):
    """Save lessons to course content JSON file."""
    course_data = {
        "lessons": lessons
    }
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(course_data, f, indent=2, ensure_ascii=False)
    
    print(f"💾 Saved {len(lessons)} lessons to {output_file}")

def generate_lesson_mappings(lessons):
    """Generate lesson mapping TypeScript files."""
    print("🗺️  Generating lesson mappings...")
    
    mappings = []
    for lesson in lessons:
        mapping = {
            "shortId": lesson['id'],
            "longId": lesson['longId'],
            "title": lesson['title']
        }
        mappings.append(mapping)
    
    # Generate TypeScript content
    timestamp = datetime.now().isoformat()
    ts_content = f'''// Auto-generated lesson mappings - COMPLETE REPLACEMENT ({timestamp})
// Contains {len(lessons)} lessons with IDs: {min(l['id'] for l in lessons)}-{max(l['id'] for l in lessons)}

export interface LessonMapping {{
  shortId: number;
  longId: string;
  title: string;
}}

export const LESSON_MAPPINGS: LessonMapping[] = {json.dumps(mappings, indent=2, ensure_ascii=False)};

/**
 * Map a long lesson ID to a short numeric ID
 * @param longId - Long lesson ID string
 * @returns Short numeric ID, or null if not found
 */
export function mapLongIdToShortId(longId: string): number | null {{
  const mapping = LESSON_MAPPINGS.find(m => m.longId === longId);
  return mapping ? mapping.shortId : null;
}}

/**
 * Detect the format of a lesson ID
 * @param lessonId - Lesson ID in any format
 * @returns 'short' for numeric IDs, 'long' for string IDs, 'invalid' for invalid format
 */
export function detectLessonIdFormat(lessonId: string): 'short' | 'long' | 'invalid' {{
  if (/^\\d+$/.test(lessonId)) {{
    return 'short';
  }} else if (lessonId.includes('_') && lessonId.length > 10) {{
    return 'long';
  }}
  return 'invalid';
}}

/**
 * Resolve any lesson ID (long or short) to a short numeric ID for internal use
 * @param lessonId - Lesson ID in any format
 * @returns Short numeric ID, or null if not found
 */
export function resolveLessonId(lessonId: string): number | null {{
  const format = detectLessonIdFormat(lessonId);
  console.log("🔍 SERVER: Resolving lesson ID:", lessonId, "format:", format);
  
  if (format === 'short') {{
    const shortId = parseInt(lessonId);
    console.log("🔍 SERVER: Resolved lesson ID:", shortId);
    return shortId;
  }} else if (format === 'long') {{
    const resolved = mapLongIdToShortId(lessonId);
    console.log("🔍 SERVER: Resolved lesson ID:", resolved);
    return resolved;
  }}
  
  console.log("❌ SERVER: Could not resolve lesson ID:", lessonId);
  return null;
}}
'''
    
    # Save server-side mapping
    with open('server/lesson-mapping.ts', 'w', encoding='utf-8') as f:
        f.write(ts_content)
    print("✅ Generated server/lesson-mapping.ts")
    
    # Save client-side mapping  
    with open('client/src/lib/lesson-mapping.ts', 'w', encoding='utf-8') as f:
        f.write(ts_content)
    print("✅ Generated client/src/lib/lesson-mapping.ts")

def main():
    """Main processing function."""
    print("🔄 COMPLETE LESSON SYSTEM REPLACEMENT")
    print("=" * 60)
    print("⚠️  This will REPLACE ALL existing lessons with CSV data")
    print("=" * 60)
    
    # File paths
    csv_file = 'server/latest_lessons.csv'
    output_file = 'server/course-content.json'
    
    try:
        # Step 1: Create backup
        print("📋 Step 1: Creating backup...")
        create_backup()
        
        # Step 2: Parse lessons from CSV
        print("📋 Step 2: Parsing CSV lessons...")
        lessons, lesson_mappings = parse_csv_lessons(csv_file)
        
        if not lessons:
            print("❌ No valid lessons found in CSV!")
            return
        
        # Step 3: Save new course content (complete replacement)
        print("📋 Step 3: Replacing course content...")
        save_course_content(lessons, output_file)
        
        # Step 4: Generate lesson mappings
        print("📋 Step 4: Generating lesson mappings...")
        generate_lesson_mappings(lessons)
        
        print("=" * 60)
        print("🎉 COMPLETE REPLACEMENT SUCCESSFUL!")
        print(f"📊 System Statistics:")
        print(f"   • Total lessons: {len(lessons)}")
        print(f"   • Lesson ID range: {min(l['id'] for l in lessons)}-{max(l['id'] for l in lessons)}")
        print(f"   • First lesson ID: {lessons[0]['id']}")
        print(f"   • Last lesson ID: {lessons[-1]['id']}")
        print(f"   • All lessons use courseId: 8")
        print("=" * 60)
        print("🔄 Server restart required to load new lessons")
        
    except Exception as e:
        print(f"❌ Error during replacement: {str(e)}")
        raise

if __name__ == "__main__":
    main()