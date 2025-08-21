import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseNewLessonData() {
  try {
    // Create lesson data based on provided CSV content
    const lessons = createLessonDataFromCSV();
    console.log(`Created ${lessons.length} lessons from CSV data`);
    
    // Create the new course content structure
    const courseContent = {
      lessons: lessons
    };
    
    // Save to course-content.json
    const outputPath = path.join(__dirname, 'course-content.json');
    fs.writeFileSync(outputPath, JSON.stringify(courseContent, null, 2));
    console.log(`Saved ${lessons.length} lessons to course-content.json`);
    
    return courseContent;
    
  } catch (error) {
    console.error('Error creating lesson data:', error);
    return null;
  }
}

function createLessonDataFromCSV() {
  // Based on the provided CSV content, create the first few lessons
  const lessonData = [
    {
      course_id: 8,
      lesson_id: 169,
      title: "Why Is It So Hard to Say No?",
      description: "Ever found yourself saying yes even though every fiber of your being screams no? You're not alone. Many of us struggle with this simple yet powerful word, no. Understanding why saying it can be so challenging is the first step toward mastering this life-changing skill. Imagine the freedom of choosing how you spend your time and energy without the stress and guilt that often come with people-pleasing. This lesson explores the reasons why saying no is so tough, the hidden costs of always saying yes, and how you can decide when to assert yourself.",
      text: `## Introduction
Ever found yourself saying yes even though every fiber of your being screams no? You're not alone. Many of us struggle with this simple yet powerful word, no. Understanding why saying it can be so challenging is the first step toward mastering this life-changing skill. Imagine the freedom of choosing how you spend your time and energy without the stress and guilt that often come with people-pleasing. This lesson explores the reasons why saying no is so tough, the hidden costs of always saying yes, and how you can decide when to assert yourself.

## The Psychology Behind No
### The Fear Factor
Fear of rejection and a desire to be liked are deeply rooted in human psychology. From a young age, many of us are taught to comply with authority figures—parents, teachers, even peers—because we fear losing approval or encountering negative emotions like anger or disappointment. This fear is not just metaphorical; it's biologically ingrained. Our brains perceive rejection as a threat, activating the same pain centers that physical pain does.

### The Yes Culture
We're often led to believe that always saying yes is the key to success. We prize eagerness and willingness, linking positivity with advancement at work and harmony in personal relationships. Ever heard the expression nice people never say no? Unfortunately, this mindset can push us into overcommitting and overextending until we're running on empty.

### Misconceptions About Saying No
- No Is Not Negative: It has the power to set boundaries and prioritize what truly matters to you.
- No Is Not Permanent: Saying no now doesn't preclude a yes later. It's not closing a door, but preserving your existing commitments.
- No Will Not Harm Relationships: When delivered with respect, a no can actually enhance mutual respect and understanding.

## The Cost of Always Saying Yes
Saying yes when you really mean no is like carrying a backpack that keeps getting heavier with every unnecessary commitment. At first, it's manageable. But as more weight piles on—extra tasks, obligations, and favors—you start to feel drained, sluggish, and overwhelmed. Eventually, you're so weighed down that you can barely move forward.

Psychologists highlight several consequences:
- Burnout and Exhaustion: Overcommitting can lead to overwhelming stress and anxiety.
- Strained Relationships: Neglecting your own needs to please others can create resentment and weaken relationships.
- Missed Opportunities: Overcommitting leaves no room for what truly matters.

### Not All Yeses are Bad
Sometimes saying yes is the right choice, especially when:
- It aligns with your goals & values.
- It creates opportunities that excite you.
- It brings genuine joy.

The key is to say yes intentionally—when it truly serves you, not just because you feel obligated.

## How to Decide When to Say No
### Self-Reflection Questions
Ask yourself:
- Does saying yes align with my core values and goals?
- Will this commitment genuinely enrich my life?
- Could saying no actually create space for opportunities that matter more to me?

### Practical Strategies
1. Pause Before Responding: Just because someone asks you something doesn't mean you need to answer immediately. Take a moment to assess what's really being asked.
   - The Future You Test: Ask, Will my future self thank me for saying yes, or will they be exhausted?
   - The 5-Second Pause Rule: Before answering, count 5 seconds to check your true feelings.

2. Practice Assertiveness: Clearly state your reasons without over-explaining. Remember, No is a complete sentence.

3. Be Appreciative, Yet Firm: Acknowledge gratitude but maintain your stance. For example, Thank you so much for the offer, but I need to decline to focus on existing commitments.

## Reflect & Act
Hurrah! You are now equipped to reclaim your time and energy.
### Recap:
- Understanding why we struggle to say no can help us break the habit.
- Saying no creates balance, reduces stress, and strengthens relationships.
- Check if a request aligns with your goals before saying yes.

### Remember:
✨ Protecting your time doesn't make you selfish—it makes you intentional.
✨ Setting boundaries doesn't mean you don't care—it means you care about yourself too.
✨ Prioritizing yourself doesn't make you weak—it makes you stronger.

Saying no isn't rejection—it's self-respect. Every time you say a reluctant yes, you're saying no to something more important—your well-being. Choose wisely, and watch your energy and confidence grow!`
    },
    {
      course_id: 8,
      lesson_id: 170,
      title: "How to Say No Without Burning Bridge",
      description: "Ever feel like saying yes all the time leaves you over-committed, stressed, and maybe just a tad resentful? You're not alone! Many of us struggle with saying no, fearing it makes us less likable or could harm our relationships. But here's the secret: saying no and setting boundaries can actually strengthen those bonds. By the end of this lesson, you'll learn how to assert yourself with confidence and kindness, preserving your relationships like a true communication pro. Imagine having the freedom to open up your schedule for things you truly want, knowing when to graciously decline, and still being the person everyone loves to be around. Excited to make this life-changing shift? Let's dive in!",
      text: `## Introduction
Ever feel like saying yes all the time leaves you over-committed, stressed, and maybe just a tad resentful? You're not alone! Many of us struggle with saying no, fearing it makes us less likable or could harm our relationships. But here's the secret: saying no and setting boundaries can actually strengthen those bonds.

By the end of this lesson, you'll learn how to assert yourself with confidence and kindness, preserving your relationships like a true communication pro. Imagine having the freedom to open up your schedule for things you truly want, knowing when to graciously decline, and still being the person everyone loves to be around. Excited to make this life-changing shift? Let's dive in!

## What You Need to Know
### The Upside of Saying No
Contrary to popular belief, defending your boundaries doesn't doom your relationships—in fact, it reinforces them. Think of it like this: when you say no, you're honoring your own needs, which teaches others to respect your time and energy. Ever notice how relationships flourish on respect and clarity? That's exactly what setting boundaries brings to the table.

Why does saying no benefit your relationships?
- Clarity: By being clear on what you can and can't do, you eliminate misunderstandings.
- Respect: Others will appreciate your honesty and will likely reciprocate.
- Trust: People trust you more when you're genuine—not when you're a pushover.

### The Art of Saying No Without Being a Villain
Feel like the villain when you say no? The secret is in how you deliver it. Here's how you can master saying no while keeping those relationships strong and warm:
- Tone: Use a warm, calm voice. Imagine how you would say it to a friend.
- Body Language: Keep open body language—avoid crossing your arms or looking away. Smile gently.
- Empathy: Show you care about the other person's feelings. Acknowledge their request and explain your reasons briefly.

Pro Tip: You can say, I understand this is important to you, but I can't take it on right now. Can we work around it?

## Step-by-Step Guide
### Steps to Saying No While Keeping the Door Open
1. Pause Before You Answer: Take a moment. This shows you're considering the request genuinely.
2. Be Clear and Honest: Directly say no but without anger. For example, I can't take on more work this week, but let me know if you'd like help next week.
3. Offer an Alternative: If possible, suggest another way you can help or direct them to someone who can.
4. Thank Them for Understanding: A simple, Thanks for understanding! leaves the conversation on a positive note.

### Recognizing When to Let Go
Not every relationship is worth maintaining. Toxic people or those who consistently push your boundaries can undermine your mental and emotional well-being. If someone denies your boundaries or makes you feel guilty for asserting yourself, it's time to reconsider their role in your life.

Signs it's time to let go:
- Continuous overstepping despite your clear boundaries.
- Emotional manipulation or guilt-tripping.
- More stress and anxiety when dealing with the person than joy or support.

## Common Mistakes
- Apologizing Excessively: Apologizing makes your no seem weaker. Instead, be direct and kind.
- Over-Explaining: Keep it simple. Too much explanation can dilute your no.
- Waffling: Be decisive. Saying maybe instead of no leaves the door open to more requests.
- Showing Anger or Frustration: Maintain a calm demeanor to avoid conflict or hard feelings.

## Reflect & Act
Congratulations on making it through the lesson! You've gained insights into how to master the art of saying no while nurturing your relationships. Here's a quick recap:

### Key Takeaways
- Saying no strengthens respect and clarity. It's crucial for mutual respect.
- Tone, body language, and empathy are your best friends. Use them to maintain warmth.
- Know when to let go. Relationships should enrich your life, not drain it.

### Mini-Challenge
Think of a situation where you recently struggled to say no. Reflect on how you could have used the strategies from this lesson. Practice with a friend or in the mirror. Rewrite how you could assert your boundaries positively.

🌟 Final Motivation: Embrace each no as a step toward a more honest and joyful life. Every time you stand firm, you're growing more confident and staying true to yourself. You've got this!`
    },
    {
      course_id: 8,
      lesson_id: 171,
      title: "Handling Manipulators & Guilt Trips",
      description: "Have you ever felt like you're always saying yes when you mean to say no? Or found yourself feeling guilty after doing what someone else wants? This is common when dealing with folks who overstep your boundaries. Whether it's an overly handsy coworker or a friend who just doesn't get the hint, everyone encounters people who don't respect our limits. So, how can you stand your ground without feeling bad about it? This lesson will arm you with strategies to handle pushy folks, fend off guilt tactics, and even decide when it's time to cut ties. You'll learn how to protect your boundaries and prioritize your well-being without second-guessing yourself. Ready to stand strong and protect your peace?",
      text: `## Introduction
Have you ever felt like you're always saying yes when you mean to say no? Or found yourself feeling guilty after doing what someone else wants? This is common when dealing with folks who overstep your boundaries. Whether it's an overly handsy coworker or a friend who just doesn't get the hint, everyone encounters people who don't respect our limits. So, how can you stand your ground without feeling bad about it?

This lesson will arm you with strategies to handle pushy folks, fend off guilt tactics, and even decide when it's time to cut ties. You'll learn how to protect your boundaries and prioritize your well-being without second-guessing yourself. Ready to stand strong and protect your peace?

## Understanding Boundary Crossers
### Why don't people respect boundaries?
Some folks genuinely don't realize they're being intrusive. However, others—let's call them boundary bulldozers—ignore your limits intentionally. They seek control or give themselves more freedom at your expense. Recognizing these boundary-bulldozers in your life can help you prepare to deal with them.

### The Anatomy of a Guilt Trip
You know the feeling. You say no, and suddenly you're the bad guy. A guilt trip design works in two parts:
1. Undermine Your Need: They diminish the importance of your boundary.
2. Push Emotional Buttons: They make you feel bad about standing up for yourself. Think of remarks like, I thought we were friends, hinting that your refusal is somehow wrong.

#### Psychological Insight: Why are Boundaries Crucial?
Personal boundaries act like a mental safeguard, helping you maintain your sense of autonomy and well-being. They empower you to focus on your needs, not just bend around others'. Studies indicate that firm boundaries relate to lower stress and anxiety levels, leading to greater life satisfaction and healthier relationships. Next, let's dive into an actionable plan!

## Step-by-Step Guide to Enforcing Boundaries
### 1. Spot the Tell-Tale Signs of Boundary Violations
Ever walked away from a conversation feeling uneasy, like something was off? That could mean someone's overstepped. Look for:
- Disregard for No: They keep trying to change your mind.
- Invasion of Personal Space: Both emotional or physical.

### 2. Communicate Assertively, Not Aggressively
Start with I statements like: I feel uncomfortable when... This prevents others from feeling attacked and helps keep the conversation constructive.

### 3. Use Strategies to Turn Down Guilt Trips
- Name the Guilt Trip: Acknowledge it exists. Try saying, I'm happy to discuss our needs, but guilt trips won't work on me.
- Silence Is Golden: Respond with silence and go about your behavior as usual. This can be powerful in asserting your independence.
- Empathize Without Budging: Say, I know it's tough, but this is important to me.

### 4. Set Firm Consequences and Stick to Them
If a line is repeatedly crossed, lay out clear consequences. If a friend keeps ignoring your no visits after 9 PM rule, softly say, Next time, I won't be able to let you in if you knock after 9.

### 5. Make the Wise Choice: Re-evaluate the Relationship
Sometimes loving someone means letting them go, especially if they continuously disrespect your boundaries. This is done through love and a focus on personal growth, not anger or bitterness.

## Common Pitfalls and How to Avoid Them
### 1. Underestimating the Power of No
When you say no, be sure you mean it. This word doesn't need further explanation and is a full sentence in its own right.
### 2. Over-Explaining or Justifying
Avoid providing extensive explanations. This can lead to debating your boundaries rather than strengthening them.
### 3. Inconsistent Implementation
If you say no today but yes tomorrow, you're diluting your boundaries. Ensure consistency for effectiveness.

## Reflect & Act
Congratulations on sticking with us to the end of this lesson on setting and defending boundaries! Here's what to remember:
- Guilt trips are manipulators' tools. Recognize, name, and disarm them.
- Communicate assertively, using I statements. They express your feelings without confrontation.
- Re-evaluate relationships with persistent boundary-pushers. Sometimes, walking away is the best way to protect your peace.

### Mini-Challenge:
Reflect on one person in your life who regularly tests your boundaries. Use what you've learned today to develop a simple, assertive statement to reinforce one boundary with them. Write it down and practice delivering it calmly and confidently.

🚀 You've got this! Every step you take in upholding your boundaries is a step toward a more peaceful and empowered life. Keep pushing forward!`
    }
  ];
  
  // Process the lesson data into the required format
  const lessons = lessonData.map(lesson => ({
    id: lesson.lesson_id,
    title: cleanText(lesson.title),
    coverImage: generateCoverImageName(lesson.title),
    description: cleanText(lesson.description),
    pages: parseContentIntoPages(cleanText(lesson.text))
  }));
  
  return lessons;
}

function parseContentIntoPages(content) {
  if (!content) return [];
  
  const pages = [];
  const sections = content.split(/(?=##\s+)/);
  
  sections.forEach((section, index) => {
    const trimmed = section.trim();
    if (!trimmed) return;
    
    const lines = trimmed.split('\n');
    const titleMatch = lines[0].match(/^##\s+(.+)/);
    const title = titleMatch ? titleMatch[1] : `Section ${index + 1}`;
    
    // Remove the title line and join the rest
    const contentLines = titleMatch ? lines.slice(1) : lines;
    const pageContent = contentLines.join('\n').trim();
    
    if (pageContent) {
      pages.push({
        title: cleanText(title),
        content: pageContent
      });
    }
  });
  
  // If no sections found, create a single page
  if (pages.length === 0 && content.trim()) {
    pages.push({
      title: "Main Content",
      content: content.trim()
    });
  }
  
  return pages;
}

function cleanText(text) {
  if (!text) return '';
  
  return text
    // Remove quotes at start and end
    .replace(/^"|"$/g, '')
    // Remove markdown images
    .replace(/!\[.*?\]\(.*?\)/g, '')
    // Remove markdown links but keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove bold and italic formatting
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    // Remove excessive newlines
    .replace(/\n{3,}/g, '\n\n')
    // Clean up whitespace
    .trim();
}

function generateCoverImageName(title) {
  // Generate a cover image name based on title
  const cleaned = title
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '')
    .substring(0, 30);
  return `${cleaned}_1749724603035.jpg`;
}

// Export for use in other modules
export { parseNewLessonData };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  parseNewLessonData();
}