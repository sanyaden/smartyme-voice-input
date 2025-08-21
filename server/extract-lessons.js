import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function extractLessons() {
  const csvPath = path.join(__dirname, '../attached_assets/SM_communication_lessons.xlsx - for test_1749725175598.csv');
  const content = fs.readFileSync(csvPath, 'utf-8');
  
  // Extract each lesson by finding the pattern: LessonName,ImageFile.jpg
  const lessonMatches = content.match(/([^,\n]+),([^,\n]+\.jpg),"## Introduction[^"]*"[^"]*","([^]*?)"/g);
  
  const lessons = [
    {
      id: 1,
      title: "How to Say No Without Burning Bridge",
      coverImage: "HowtoSayNoWithoutBurningBridge.jpg",
      description: `Ever feel like saying "yes" all the time leaves you over-committed, stressed, and maybe just a tad resentful? You're not alone! Many of us struggle with saying **"no,"** fearing it makes us less likable or could harm our relationships. But here's the secret: saying "no" and setting boundaries can actually strengthen those bonds.

By the end of this lesson, you'll learn how to assert yourself with confidence and kindness, preserving your relationships like a true communication pro. Imagine having the freedom to open up your schedule for things you truly want, knowing when to graciously decline, and still being the person everyone loves to be around. Excited to make this life-changing shift? Let's dive in!`,
      pages: [
        {
          title: "Key Concepts",
          content: `## What You Need to Know 🔍
### The Upside of Saying "No"
Contrary to popular belief, defending your boundaries doesn't doom your relationships—in fact, it reinforces them. Think of it like this: when you say "no," you're honoring your own needs, which teaches others to **respect your time and energy**. Ever notice how relationships flourish on respect and clarity? That's exactly what setting boundaries brings to the table.

**Why does saying no benefit your relationships?**
- **Clarity:** By being clear on what you can and can't do, you eliminate misunderstandings.
- **Respect:** Others will appreciate your honesty and will likely reciprocate.
- **Trust:** People trust you more when you're genuine—not when you're a pushover.

### The Art of Saying No Without Being a Villain
Feel like the villain when you say "no"? The secret is in **how** you deliver it. Here's how you can master saying "no" while keeping those relationships strong and warm:
- **Tone:** Use a warm, calm voice. Imagine how you would say it to a friend.
- **Body Language:** Keep open body language—avoid crossing your arms or looking away. Smile gently.
- **Empathy:** Show you care about the other person's feelings. Acknowledge their request and explain your reasons briefly.

**Pro Tip:** You can say, *"I understand this is important to you, but I can't take it on right now. Can we work around it?"*`
        },
        {
          title: "Step-by-Step Guide",
          content: `## Step-by-Step Guide 🚀
### Steps to Saying No While Keeping the Door Open
1. **Pause Before You Answer:** Take a moment. This shows you're considering the request genuinely.
2. **Be Clear and Honest:** Directly say "no" but without anger. For example, "*I can't take on more work this week, but let me know if you'd like help next week.*"
3. **Offer an Alternative:** If possible, suggest another way you can help or direct them to someone who can.
4. **Thank Them for Understanding:** A simple, "Thanks for understanding!" leaves the conversation on a positive note.

### Recognizing When to Let Go
Not every relationship is worth maintaining. **Toxic people** or those who consistently push your boundaries can undermine your mental and emotional well-being. If someone denies your boundaries or makes you feel guilty for asserting yourself, it's time to reconsider their role in your life.

Signs it's time to let go:
- Continuous overstepping despite your clear boundaries.
- Emotional manipulation or guilt-tripping.
- More stress and anxiety when dealing with the person than joy or support.`
        },
        {
          title: "Practice & Reflection",
          content: `## Common Mistakes ❌
- **Apologizing Excessively:** Apologizing makes your "no" seem weaker. Instead, be direct and kind.
- **Over-Explaining:** Keep it simple. Too much explanation can dilute your "no."
- **Waffling:** Be decisive. Saying "maybe" instead of "no" leaves the door open to more requests.
- **Showing Anger or Frustration:** Maintain a calm demeanor to avoid conflict or hard feelings.

## Reflect & Act 🎯
Congratulations on making it through the lesson! You've gained insights into how to master the art of saying "no" while nurturing your relationships. Here's a quick recap:

### Key Takeaways
- **Saying no strengthens respect and clarity.** It's crucial for mutual respect.
- **Tone, body language, and empathy are your best friends.** Use them to maintain warmth.
- **Know when to let go.** Relationships should enrich your life, not drain it.

### Mini-Challenge
Think of a situation where you recently struggled to say "no." Reflect on how you could have used the strategies from this lesson. Practice with a friend or in the mirror. Rewrite how you could assert your boundaries positively.

🌟 **Final Motivation:** Embrace each "no" as a step toward a more honest and joyful life. Every time you stand firm, you're growing more confident and staying true to yourself. You've got this!`
        }
      ]
    },
    {
      id: 2,
      title: "Handling Manipulators & Guilt Trips",
      coverImage: "HandlingManipulatorsGuiltTrips.jpg",
      description: `Have you ever felt like you're always saying "yes" when you mean to say "no"? Or found yourself feeling guilty after doing what someone else wants? This is common when dealing with folks who overstep your boundaries. Whether it's an overly handsy coworker or a friend who just doesn't get the hint, everyone encounters people who don't respect our limits. So, how can you stand your ground without feeling bad about it?

This lesson will arm you with strategies to handle pushy folks, fend off guilt tactics, and even decide when it's time to cut ties. You'll learn how to protect your boundaries and prioritize your well-being without second-guessing yourself. Ready to stand strong and protect your peace?`,
      pages: [
        {
          title: "Understanding Boundary Crossers",
          content: `## Understanding Boundary Crossers 🔍
### Why don't people respect boundaries?
Some folks genuinely don't realize they're being intrusive. However, others—let's call them **boundary bulldozers**—ignore your limits intentionally. They seek control or give themselves more freedom at your expense. Recognizing these boundary-bulldozers in your life can help you prepare to deal with them.

### The Anatomy of a Guilt Trip
You know the feeling. You say "no," and suddenly you're the bad guy. A guilt trip design works in two parts:
1. **Undermine Your Need:** They diminish the importance of your boundary.
2. **Push Emotional Buttons:** They make you feel bad about standing up for yourself. Think of remarks like, "I thought we were friends," hinting that your refusal is somehow wrong.

#### Psychological Insight: Why are Boundaries Crucial?
**Personal boundaries** act like a mental safeguard, helping you maintain your sense of autonomy and well-being. They empower you to focus on your needs, not just bend around others'. Studies indicate that firm boundaries relate to lower stress and anxiety levels, leading to greater life satisfaction and healthier relationships. Next, let's dive into an actionable plan!`
        },
        {
          title: "Step-by-Step Guide to Enforcing Boundaries",
          content: `## Step-by-Step Guide to Enforcing Boundaries 🚀
### 1. **Spot the Tell-Tale Signs of Boundary Violations**
Ever walked away from a conversation feeling uneasy, like something was off? That could mean someone's overstepped. Look for:
- **Disregard for "No":** They keep trying to change your mind.
- **Invasion of Personal Space:** Both emotional or physical.

### 2. **Communicate Assertively, Not Aggressively**
Start with "I" statements like: *"I feel uncomfortable when...*. This prevents others from feeling attacked and helps keep the conversation constructive.

### 3. **Use Strategies to Turn Down Guilt Trips**
- **Name the Guilt Trip:** Acknowledge it exists. Try saying, *"I'm happy to discuss our needs, but guilt trips won't work on me."*
- **Silence Is Golden:** Respond with silence and go about your behavior as usual. This can be powerful in asserting your independence.
- **Empathize Without Budging:** Say, *"I know it's tough, but this is important to me."*

### 4. **Set Firm Consequences and Stick to Them**
If a line is repeatedly crossed, lay out clear consequences. If a friend keeps ignoring your "no visits after 9 PM" rule, softly say, *"Next time, I won't be able to let you in if you knock after 9."*

### 5. **Make the Wise Choice: Re-evaluate the Relationship**
Sometimes loving someone means letting them go, especially if they continuously disrespect your boundaries. This is done through love and a focus on personal growth, not anger or bitterness.`
        },
        {
          title: "Common Pitfalls and Reflection",
          content: `## Common Pitfalls and How to Avoid Them ❌
### 1. **Underestimating the Power of "No"**
When you say "no," be sure you mean it. This word doesn't need further explanation and is a full sentence in its own right.
### 2. **Over-Explaining or Justifying**
Avoid providing extensive explanations. This can lead to debating your boundaries rather than strengthening them.
### 3. **Inconsistent Implementation**
If you say "no" today but "yes" tomorrow, you're diluting your boundaries. Ensure consistency for effectiveness.

## Reflect & Act 🎯
Congratulations on sticking with us to the end of this lesson on setting and defending boundaries! Here's what to remember:
- **Guilt trips are manipulators' tools.** Recognize, name, and disarm them.
- **Communicate assertively, using "I" statements.** They express your feelings without confrontation.
- **Re-evaluate relationships with persistent boundary-pushers.** Sometimes, walking away is the best way to protect your peace.

### Mini-Challenge:
Reflect on one person in your life who regularly tests your boundaries. Use what you've learned today to develop a simple, assertive statement to reinforce one boundary with them. Write it down and practice delivering it calmly and confidently.

🚀 **You've got this!** Every step you take in upholding your boundaries is a step toward a more peaceful and empowered life. Keep pushing forward!`
        }
      ]
    }
  ];

  return { lessons };
}

const courseData = extractLessons();
const outputPath = path.join(__dirname, 'course-content-final.json');
fs.writeFileSync(outputPath, JSON.stringify(courseData, null, 2));

console.log('Generated course content with 2 lessons as sample. Need to complete remaining 5 lessons.');