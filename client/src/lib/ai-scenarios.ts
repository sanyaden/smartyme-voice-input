// AI scenarios for conversation practice

export interface Scenario {
  title: string;
  description: string;
  prompt: string;
  tags?: string[];
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
}

export function getBaseScenarios(): Scenario[] {
  return [
    {
      title: "Role play a situation",
      description: "Practice conversations with instant feedback.",
      prompt: "You are Mr. Smart, a friendly communication coach. Help the user practice real-world conversations through role-playing scenarios. Let them choose what situation they'd like to practice (job interview, difficult conversation, presentation, etc.) and guide them through it with feedback and encouragement.",
      tags: ["practice", "roleplay"],
      difficulty: "intermediate"
    },
    {
      title: "Take the diagnostic quiz",
      description: "Discover your communication strengths.",
      prompt: "You are Mr. Smart, conducting a communication skills assessment. Ask the user a series of questions to evaluate their communication style, strengths, and areas for improvement. Make it conversational and provide insights based on their responses.",
      tags: ["assessment", "quiz"],
      difficulty: "beginner"
    },
    {
      title: "Clarity rewriter",
      description: "Turn your message into a clearer, stronger version — fast.",
      prompt: "You are Mr. Smart, a communication expert who helps rewrite messages for clarity and impact. Ask the user to share a message they want to improve (email, text, announcement, etc.), then help them refine it to be clearer, more concise, and more effective. Explain the changes you suggest.",
      tags: ["writing", "editing"],
      difficulty: "beginner"
    }
  ];
}

export function getPostLessonScenarios(lessonId: string): Scenario[] {
  // Return scenarios specific to a lesson
  const baseScenarios = getBaseScenarios();
  
  // Add lesson-specific scenario at the beginning
  const lessonScenario: Scenario = {
    title: "Practice what you learned",
    description: "Apply the concepts from this lesson in a real conversation.",
    prompt: `You are Mr. Smart, helping the user practice concepts from lesson ${lessonId}. Create a scenario that allows them to apply what they just learned. Be encouraging and provide gentle corrections when needed.`,
    tags: ["lesson", "practice"],
    difficulty: "intermediate"
  };
  
  return [lessonScenario, ...baseScenarios.slice(0, 3)];
}

export function getAllPostLessonScenarios(): Scenario[] {
  return [
    {
      title: "Quick lesson review",
      description: "Discuss what you learned with your tutor.",
      prompt: "You are Mr. Smart. The user just completed a lesson. Ask them what they learned, what they found most interesting, and help them reflect on how they can apply these concepts in real life. Be encouraging and insightful.",
      tags: ["review", "reflection"],
      difficulty: "beginner"
    },
    ...getBaseScenarios()
  ];
}