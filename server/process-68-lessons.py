#!/usr/bin/env python3
"""
Process the full 68 lessons CSV and generate updated lesson mappings and course content.
This script extracts all lessons from the CSV and creates the necessary files for the SmartyMe platform.
"""

import csv
import json
import os
import re
from datetime import datetime

def main():
    print("🚀 Processing full lessons CSV with 68+ lessons...")
    
    # Find the CSV file
    csv_path = find_lessons_csv()
    if not csv_path:
        print("❌ Could not find lessons CSV file")
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
    generate_lesson_summary(lessons)
    
    print(f"🎉 Successfully integrated {len(lessons)} lessons into the system!")

def find_lessons_csv():
    """Find the lessons CSV file with the most recent data."""
    import glob
    
    patterns = [
        'attached_assets/*1751378844419*.csv',
        'attached_assets/*lessons_with_id*.csv',
        'attached_assets/new_lessons.csv'
    ]
    
    for pattern in patterns:
        files = glob.glob(pattern)
        if files:
            csv_path = files[0]
            print(f"📄 Found CSV file: {csv_path}")
            return csv_path
    
    return None

def parse_lessons_csv(csv_path):
    """Parse the CSV file and extract lesson data."""
    lessons = []
    
    try:
        with open(csv_path, 'r', encoding='utf-8') as file:
            # Read the CSV
            csv_reader = csv.DictReader(file)
            
            print("📋 CSV columns:", list(csv_reader.fieldnames))
            
            for row in csv_reader:
                lesson = parse_lesson_row(row)
                if lesson:
                    lessons.append(lesson)
                    
                # Progress update for large files
                if len(lessons) % 100 == 0:
                    print(f"   Processed {len(lessons)} lessons...")
    
    except Exception as e:
        print(f"❌ Error reading CSV: {e}")
        return []
    
    return lessons

def parse_lesson_row(row):
    """Parse a single CSV row into a lesson object."""
    try:
        # Handle different column name variations
        lesson_id = get_field_value(row, ['lesson_id_new', 'id', 'lesson_id'])
        long_id = get_field_value(row, ['lesson_id', 'long_id', 'lesson_long_id'])
        title = get_field_value(row, ['title', 'lesson_title', 'name'])
        content = get_field_value(row, ['text', 'description', 'content'])
        course_id = get_field_value(row, ['course_id_new', 'course_id'])
        
        if not lesson_id or not long_id or not title:
            return None
            
        # Convert lesson_id to integer
        try:
            lesson_id = int(lesson_id)
        except ValueError:
            return None
        
        # Clean and process the data
        return {
            'id': lesson_id,
            'longId': long_id.strip(),
            'title': clean_text(title),
            'description': create_description(content),
            'content': clean_text(content),
            'courseId': int(course_id) if course_id and course_id.isdigit() else extract_course_id(long_id),
            'coverImage': generate_cover_image_name(title)
        }
        
    except Exception as e:
        print(f"⚠️  Error parsing lesson row: {e}")
        return None

def get_field_value(row, field_names):
    """Get field value from row, trying multiple possible field names."""
    for field_name in field_names:
        if field_name in row and row[field_name]:
            return row[field_name]
    return None

def clean_text(text):
    """Clean and normalize text content."""
    if not text:
        return ""
    
    # Remove extra whitespace and normalize quotes
    cleaned = re.sub(r'\s+', ' ', text.strip())
    cleaned = cleaned.replace('""', '"')
    cleaned = cleaned.replace("''", "'")
    
    return cleaned

def create_description(content):
    """Create a lesson description from the content."""
    if not content:
        return ""
    
    # Take first 300 characters as description
    description = clean_text(content)
    if len(description) > 300:
        description = description[:300] + "..."
    
    return description

def extract_course_id(long_id):
    """Extract course ID from the long lesson ID."""
    if not long_id:
        return 1
    
    topic = long_id.lower().split('__')[0] if '__' in long_id else long_id.lower()
    
    # Map topics to course IDs
    course_mapping = {
        'communication_skills': 8,
        'public_speaking': 9,
        'leadership': 10,
        'workplace': 11,
        'relationship': 12,
        'negotiation': 13,
        'presentation': 14,
        'confidence': 15
    }
    
    for keyword, course_id in course_mapping.items():
        if keyword in topic:
            return course_id
    
    return 1  # Default course ID

def generate_cover_image_name(title):
    """Generate a cover image filename from the lesson title."""
    if not title:
        return "default_cover.jpg"
    
    # Remove special characters and create filename
    filename = re.sub(r'[^a-zA-Z0-9\s]', '', title)
    filename = re.sub(r'\s+', '', filename)
    filename = filename[:30]  # Limit length
    
    return f"{filename}_cover.jpg"

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

export const LESSON_MAPPINGS: LessonMapping[] = {json.dumps(mappings, indent=2)};

/**
 * Convert long lesson ID to short ID for internal system use
 * @param longId - Long lesson ID from mobile app URL
 * @returns Short numeric ID for internal system, or null if not found
 */
export function mapLongIdToShortId(longId: string): number | null {{
  const decoded = decodeURIComponent(longId);
  console.log("🔍 SERVER: Mapping long ID to short ID:", decoded);
  
  // Try exact match first
  const exactMatch = LESSON_MAPPINGS.find(mapping => mapping.longId === decoded);
  if (exactMatch) {{
    console.log("✅ SERVER: Found exact match:", exactMatch.shortId);
    return exactMatch.shortId;
  }}
  
  // Try partial match (in case of slight variations)
  const partialMatch = LESSON_MAPPINGS.find(mapping => 
    mapping.longId.includes(decoded) || decoded.includes(mapping.longId)
  );
  if (partialMatch) {{
    console.log("✅ SERVER: Found partial match:", partialMatch.shortId);
    return partialMatch.shortId;
  }}
  
  console.log("❌ SERVER: No mapping found for long ID:", decoded);
  return null;
}}

/**
 * Convert short lesson ID to long ID 
 * @param shortId - Short numeric lesson ID
 * @returns Long lesson ID string, or null if not found
 */
export function mapShortIdToLongId(shortId: number): string | null {{
  const mapping = LESSON_MAPPINGS.find(mapping => mapping.shortId === shortId);
  return mapping ? mapping.longId : null;
}}

/**
 * Determine if a lesson ID is in long format (string) or short format (number)
 * @param lessonId - Lesson ID to check
 * @returns 'long' | 'short' | 'invalid'
 */
export function detectLessonIdFormat(lessonId: string): 'long' | 'short' | 'invalid' {{
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

def generate_lesson_summary(lessons):
    """Generate a summary file for reference."""
    
    # Group lessons by course
    courses = {}
    for lesson in lessons:
        course_id = lesson['courseId']
        if course_id not in courses:
            courses[course_id] = []
        courses[course_id].append(lesson)
    
    # Create summary
    summary_lines = [
        f"# Lesson Integration Summary ({datetime.now().isoformat()})",
        "",
        f"**Total Lessons:** {len(lessons)}",
        f"**Courses:** {len(courses)}",
        "",
        "## Lessons by Course:",
        ""
    ]
    
    for course_id, course_lessons in sorted(courses.items()):
        summary_lines.append(f"### Course {course_id} ({len(course_lessons)} lessons)")
        for lesson in sorted(course_lessons, key=lambda x: x['id'])[:5]:  # Show first 5
            summary_lines.append(f"- {lesson['id']}: {lesson['title']}")
        if len(course_lessons) > 5:
            summary_lines.append(f"- ... and {len(course_lessons) - 5} more lessons")
        summary_lines.append("")
    
    # Sample lesson IDs for testing
    sample_lessons = lessons[:10]
    summary_lines.extend([
        "## Sample Lesson IDs for Testing:",
        ""
    ])
    
    for lesson in sample_lessons:
        summary_lines.append(f"**{lesson['id']}:** {lesson['title']}")
        summary_lines.append(f"Long ID: `{lesson['longId']}`")
        summary_lines.append("")
    
    # Save summary
    with open('lesson-integration-summary.md', 'w', encoding='utf-8') as f:
        f.write('\n'.join(summary_lines))
    
    print("✅ Generated lesson-integration-summary.md")

if __name__ == "__main__":
    main()