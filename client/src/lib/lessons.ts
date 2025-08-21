// Lesson types and utilities

export interface Lesson {
  id: string;
  title: string;
  description?: string;
  duration?: number;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  topics?: string[];
  content?: LessonContent;
}

export interface LessonContent {
  sections: LessonSection[];
  quiz?: Quiz;
}

export interface LessonSection {
  id: string;
  title: string;
  content: string;
  type: 'text' | 'video' | 'interactive';
}

export interface Quiz {
  questions: QuizQuestion[];
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}