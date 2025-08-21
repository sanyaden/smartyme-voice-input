#!/usr/bin/env python3
"""
Update lesson content from the new CSV file.
This script processes the updated CSV and replaces all lesson content while using legacy_id as the primary identifier.
"""

import csv
import json
import os
import re
from datetime import datetime

def main():
    print("🚀 Updating lessons from new CSV data...")
    
    csv_path = "attached_assets/SM_Lessons_18.7_updated - SM_Lessons 20250718-91448_1752833639729.csv"
    
    if not os.path.exists(csv_path):
        print(f"❌ CSV file not found: {csv_path}")
        return
    
    # Parse CSV data
    lessons = parse_lessons_csv(csv_path)
    if not lessons:
        print("❌ No lessons parsed from CSV")
        return
    
    print(f"✅ Successfully parsed {len(lessons)} lessons")
    
    # Generate outputs
    generate_lesson_mappings(lessons)
    generate_course_content(lessons)
    
    print(f"🎉 Successfully updated {len(lessons)} lessons in the system!")

def parse_lessons_csv(csv_path):
    """Parse the CSV file and extract lesson data."""
    lessons = []
    
    try:
        with open(csv_path, 'r', encoding='utf-8') as file:
            csv_reader = csv.DictReader(file)
            
            print("📋 CSV columns:", list(csv_reader.fieldnames))
            
            for idx, row in enumerate(csv_reader):
                lesson = parse_lesson_row(row, idx + 1)
                if lesson:
                    lessons.append(lesson)
                    
                if len(lessons) % 20 == 0:
                    print(f"   Processed {len(lessons)} lessons...")
                    
    except Exception as e:
        print(f"❌ Error reading CSV: {e}")
        return []
    
    return lessons

def parse_lesson_row(row, sequence_id):
    """Parse a single CSV row into lesson data."""
    title = row.get('title', '').strip()
    legacy_id = row.get('legacy_id', '').strip()
    text = row.get('text', '').strip()
    short_description = row.get('short_description', '').strip()
    description = row.get('description', '').strip()
    
    # Skip if missing essential data
    if not title or not legacy_id or not text:
        return None
    
    # Generate cover image filename from title
    cover_image = generate_cover_image_name(title)
    
    # Use description if available, otherwise use short_description
    lesson_description = description if description else short_description
    
    return {
        'id': sequence_id,  # Sequential numeric ID
        'longId': legacy_id,
        'courseId': 8,
        'title': title,
        'description': clean_text(lesson_description)[:200] + "..." if len(lesson_description) > 200 else clean_text(lesson_description),
        'coverImage': cover_image,
        'content': clean_text(text)
    }

def clean_text(text):
    """Clean and normalize text content."""
    if not text:
        return ""
    
    # Remove extra whitespace and normalize line breaks
    text = re.sub(r'\n\s*\n\s*\n+', '\n\n', text)
    text = re.sub(r'[ \t]+', ' ', text)
    text = text.strip()
    
    return text

def generate_cover_image_name(title):
    """Generate cover image filename from lesson title."""
    # Remove special characters and spaces, convert to camelCase
    clean_title = re.sub(r'[^\w\s]', '', title)
    words = clean_title.split()
    
    if not words:
        return "lesson_cover.jpg"
    
    # Convert to camelCase
    camel_case = words[0].lower()
    for word in words[1:]:
        camel_case += word.capitalize()
    
    return f"{camel_case}_cover.jpg"

def generate_lesson_mappings(lessons):
    """Generate the lesson mapping files for both client and server."""
    
    mappings = [
        {
            'shortId': lesson['id'],
            'longId': lesson['longId'], 
            'title': lesson['title']
        }
        for lesson in lessons
    ]
    
    # Sort by shortId for consistency
    mappings.sort(key=lambda x: x['shortId'])
    
    # Generate TypeScript content
    ts_content = f"""// Auto-generated lesson mappings from CSV ({datetime.now().isoformat()})
// Contains {len(mappings)} lessons

export interface LessonMapping {{
  shortId: number;
  longId: string;
  title: string;
}}

export const LESSON_MAPPINGS: LessonMapping[] = {json.dumps(mappings, indent=2, ensure_ascii=False)};

/**
 * Map a long ID to its corresponding short numeric ID
 * @param longId - The long string identifier for the lesson
 * @returns Short numeric ID, or null if not found
 */
export function mapLongIdToShortId(longId: string): number | null {{
  const mapping = LESSON_MAPPINGS.find(m => m.longId === longId);
  return mapping ? mapping.shortId : null;
}}

/**
 * Map a short numeric ID to its corresponding long ID
 * @param shortId - The short numeric identifier for the lesson
 * @returns Long string ID, or null if not found
 */
export function mapShortIdToLongId(shortId: number): string | null {{
  const mapping = LESSON_MAPPINGS.find(m => m.shortId === shortId);
  return mapping ? mapping.longId : null;
}}

/**
 * Detect the format of a lesson ID
 * @param lessonId - Lesson ID in any format
 * @returns Format type: 'short', 'long', or 'invalid'
 */
export function detectLessonIdFormat(lessonId: string): 'short' | 'long' | 'invalid' {{
  if (/^\\d+$/.test(lessonId)) return 'short';
  if (lessonId.includes('_') || lessonId.length > 10) return 'long';
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
"""
    
    # Save server-side mapping
    with open('server/lesson-mapping.ts', 'w', encoding='utf-8') as f:
        f.write(ts_content)
    print("✅ Generated server/lesson-mapping.ts")
    
    # Save client-side mapping  
    with open('client/src/lib/lesson-mapping.ts', 'w', encoding='utf-8') as f:
        f.write(ts_content)
    print("✅ Generated client/src/lib/lesson-mapping.ts")

def generate_course_content(lessons):
    """Generate the course content JSON file."""
    
    course_lessons = []
    for lesson in lessons:
        course_lessons.append({
            'id': lesson['id'],
            'longId': lesson['longId'],
            'courseId': lesson['courseId'],
            'title': lesson['title'],
            'description': lesson['description'],
            'coverImage': lesson['coverImage'],
            'pages': [
                {
                    'title': 'Content',
                    'content': lesson['content']
                }
            ]
        })
    
    # Sort lessons by ID
    course_lessons.sort(key=lambda x: x['id'])
    
    course_content = {
        'lessons': course_lessons
    }
    
    # Save course content
    with open('server/course-content.json', 'w', encoding='utf-8') as f:
        json.dump(course_content, f, indent=2, ensure_ascii=False)
    
    print(f"✅ Generated server/course-content.json with {len(course_lessons)} lessons")

if __name__ == "__main__":
    main()