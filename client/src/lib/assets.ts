/**
 * Centralized Asset Imports
 * 
 * This file centralizes all asset imports to prevent circular dependencies
 * and temporal dead zone errors during bundling.
 */

// Import all assets first
import mrSmartImageSrc from "@assets/mr-smart.png";
import rolePlayImageSrc from "@assets/Role-play-a-situation.png";
import quizImageSrc from "@assets/take-the-quiz.png";
import lessonQuizImageSrc from "@assets/image 56_1749809015467.png";
import phraseDetoxImageSrc from "@assets/Phrase-detox-coach.png";
import clarityRewriterImageSrc from "@assets/image 54_1749810030004.png";
import microphoneIconSrc from "@assets/microphone-icon.svg";

// Export for other components to use
export const mrSmartImage = mrSmartImageSrc;
export const rolePlayImage = rolePlayImageSrc;
export const quizImage = quizImageSrc;
export const lessonQuizImage = lessonQuizImageSrc;
export const phraseDetoxImage = phraseDetoxImageSrc;
export const clarityRewriterImage = clarityRewriterImageSrc;
export const microphoneIcon = microphoneIconSrc;

// Function to get the appropriate image for each scenario
export function getScenarioImage(title: string): string {
  const titleLower = title.toLowerCase();
  
  if (titleLower.includes("voice") || titleLower.includes("microphone")) {
    return microphoneIcon;
  } else if (titleLower.includes("role play")) {
    return rolePlayImage;
  } else if (titleLower.includes("quick quiz on") || titleLower.includes("quiz on this lesson")) {
    return lessonQuizImage;
  } else if (titleLower.includes("quiz") || titleLower.includes("diagnostic")) {
    return quizImage;
  } else if (titleLower.includes("phrase") || titleLower.includes("detox")) {
    return phraseDetoxImage;
  } else if (titleLower.includes("clarity rewriter")) {
    return clarityRewriterImage;
  }
  
  return quizImage; // fallback
}