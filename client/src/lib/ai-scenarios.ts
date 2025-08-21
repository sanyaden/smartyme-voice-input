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
      title: "Friendly Small Talk",
      description: "Practice casual conversation with a friendly colleague.",
      prompt: "You are Mr. Smart, a friendly communication coach. Engage in casual small talk with the user, asking about their day, interests, and helping them practice light conversation skills. Be warm, encouraging, and help them feel comfortable.",
      tags: ["social", "casual"],
      difficulty: "beginner"
    },
    {
      title: "Professional Introduction",
      description: "Practice introducing yourself in a professional setting.",
      prompt: "You are Mr. Smart, playing the role of a potential business contact at a networking event. Help the user practice their professional introduction, ask relevant questions about their work, and provide feedback on their communication style.",
      tags: ["professional", "networking"],
      difficulty: "intermediate"
    },
    {
      title: "Conflict Resolution",
      description: "Practice handling workplace disagreements constructively.",
      prompt: "You are Mr. Smart, playing the role of a colleague with whom the user has a disagreement about a project approach. Be reasonable but initially disagree with their perspective. Help them practice assertive communication and finding common ground.",
      tags: ["workplace", "conflict"],
      difficulty: "advanced"
    },
    {
      title: "Giving Feedback",
      description: "Practice delivering constructive feedback to a team member.",
      prompt: "You are Mr. Smart, playing the role of a team member who needs to receive feedback. React realistically to the user's feedback, and help them practice delivering criticism constructively and diplomatically.",
      tags: ["leadership", "feedback"],
      difficulty: "intermediate"
    },
    {
      title: "Active Listening",
      description: "Practice active listening skills in conversation.",
      prompt: "You are Mr. Smart, sharing a complex problem or story. Evaluate how well the user demonstrates active listening through their responses, questions, and engagement. Provide subtle coaching on improving their listening skills.",
      tags: ["skills", "listening"],
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