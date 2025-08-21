# SmartyMe - Advanced AI Communication Skills Platform

A cutting-edge full-stack EdTech application that revolutionizes communication skills development through intelligent AI tutoring, adaptive learning paths, and immersive practice scenarios. Built with enterprise-grade technologies to deliver personalized, effective communication training experiences.

## 🎯 Platform Overview

SmartyMe is a comprehensive communication skills mastery platform featuring:
- **AI-Powered Tutoring**: GPT-4o driven intelligent conversation partner (Mr. Smart)
- **Adaptive Learning Engine**: Dynamic content generation based on user progress
- **Interactive Lesson System**: Multi-part structured learning with progress persistence
- **Real-Time Practice Environment**: Immersive role-play scenarios with instant feedback
- **Mobile-First Architecture**: Native-feeling responsive design optimized for smartphones
- **Comprehensive Analytics**: User progress tracking and learning outcome measurement

## 🚀 Core Features & Capabilities

### 📚 Intelligent Learning Management System
- **Multi-Part Lesson Structure**: Sequential content delivery with automatic progression
- **Progress Persistence**: Resume learning from exact position across sessions
- **Completion Tracking**: Individual lesson part advancement with achievement recognition
- **Adaptive Unlocking**: Context-aware content availability based on prerequisites
- **Learning Path Optimization**: Personalized progression recommendations

### 🤖 AI Tutor Integration (Mr. Smart)
- **Dynamic Conversation Engine**: Real-time adaptive responses based on user input
- **Scenario-Based Learning**: Contextual practice environments for skill application
- **Intelligent Suggestion System**: AI-powered response recommendations during conversations
- **Progress-Aware Coaching**: Personalized feedback based on lesson completion history
- **Multi-Modal Interaction**: Text-based conversations with visual feedback elements

### 🎭 Interactive Practice Scenarios

#### Scenario Categories

**1. Workplace Communication Excellence**
- **Conflict Resolution**: Handle project disagreements with peers professionally
- **Boundary Setting**: Decline extra work while maintaining positive relationships
- **Feedback Delivery**: Provide constructive criticism effectively and diplomatically
- **Salary Negotiation**: Navigate professional advancement conversations confidently
- **Change Management**: Communicate organizational transitions to resistant team members

**2. Difficult Conversation Mastery**
- **Apology & Repair**: Address mistakes professionally and rebuild trust
- **Service Recovery**: De-escalate angry customer situations with empathy
- **Objection Handling**: Address pricing concerns and competitor comparisons
- **Needs Discovery**: Uncover client goals and underlying motivations

**3. Personal Relationship Navigation**
- **Family Dynamics**: Address household responsibility imbalances constructively
- **Friend Support**: Help others navigate work-life challenges without overstepping
- **Social Confidence**: Join group conversations and networking events naturally
- **Boundary Enforcement**: Maintain healthy personal limits without guilt

**4. Advanced Communication Scenarios**
- **Decision Trees**: Branching dialogue practice with consequence analysis
- **Cultural Communication**: Navigate diverse communication styles and expectations
- **Crisis Communication**: Handle high-pressure situations with clarity and composure
- **Persuasion & Influence**: Ethical influence techniques for positive outcomes

### 📱 Mobile App Integration (Webview)
- **Seamless Mobile Integration**: WebView component for native mobile apps
- **URL Parameter Support**: `user_id`, `lesson_id`, `course_id` for contextual entry
- **Contained Experience**: No navigation back to web app - maintains mobile app flow
- **Cross-Platform Analytics**: Track mobile app users through web-based AI tutor sessions
- **Lesson Context Awareness**: AI scenarios dynamically adapt based on completed mobile lessons
- **Database Integration**: Full tracking of webview sessions separate from web app usage

### 📊 Analytics & Progress Tracking
- **Session Analytics**: Track conversation length, message count, completion rates, and entry points
- **User Progress Metrics**: Lesson completion, scenario participation, and skill development across platforms
- **Source Differentiation**: Separate tracking for web app vs. webview usage patterns
- **Conversation Feedback**: Post-session ratings and improvement recommendations
- **Learning Insights**: Cross-platform communication strengths and growth opportunities
- **Admin Dashboard**: Comprehensive metrics for platform performance and user engagement

## 🏗️ Enterprise-Grade Technical Architecture

### Frontend Technology Stack
- **React 18** with TypeScript for type-safe component development
- **Vite** for lightning-fast development and optimized production builds
- **Wouter** for lightweight, performance-optimized client-side routing
- **TanStack Query v5** for intelligent data fetching, caching, and synchronization
- **Tailwind CSS + Shadcn/ui** for enterprise-level design system consistency
- **Framer Motion** for fluid animations and micro-interactions
- **React Hook Form** with Zod validation for robust form management
- **Radix UI** primitives for accessible, headless component foundations

### Backend Infrastructure
- **Node.js 20** with Express.js for high-performance API services
- **Drizzle ORM** with PostgreSQL for type-safe database operations
- **Passport.js** for enterprise authentication and session management
- **WebSocket (ws)** for real-time communication capabilities
- **OpenAI GPT-4o** integration for advanced AI tutoring
- **Express Session** with PostgreSQL store for scalable session management
- **Zod** for comprehensive API request/response validation

### Advanced Architecture Patterns

#### State Management Strategy
- **Server State**: TanStack Query for efficient data fetching and caching
- **Client State**: React hooks for UI state management
- **Session State**: SessionStorage for temporary workflow data
- **Persistent State**: PostgreSQL with Drizzle ORM for long-term data storage

#### Database Schema Design
```sql
-- Users table for authentication and tracking
users: {
  id (SERIAL PRIMARY KEY),
  email (TEXT NOT NULL UNIQUE),
  created_at (TIMESTAMP DEFAULT NOW()),
  last_active_at (TIMESTAMP DEFAULT NOW())
}

-- Chat sessions with webview integration support
chat_sessions: {
  id (SERIAL PRIMARY KEY),
  session_id (TEXT NOT NULL UNIQUE),
  user_email (TEXT NOT NULL),
  scenario_title (TEXT NOT NULL),
  scenario_prompt (TEXT NOT NULL),
  message_count (INTEGER DEFAULT 0),
  is_abandoned (BOOLEAN DEFAULT FALSE),
  abandoned_at (TIMESTAMP),
  completed_at (TIMESTAMP),
  duration (INTEGER), -- in seconds
  entry_point (TEXT), -- 'webview', 'main_screen', 'lesson_end'
  created_at (TIMESTAMP DEFAULT NOW()),
  -- Webview integration fields
  user_id (TEXT), -- Mobile app user identifier
  lesson_id (INTEGER), -- Associated lesson from mobile app
  course_id (INTEGER), -- Associated course from mobile app
  source (TEXT DEFAULT 'web_app'), -- 'webview' or 'web_app'
  webview_entry_timestamp (TIMESTAMP)
}

-- Individual chat messages with conversation flow
chat_messages: {
  id (SERIAL PRIMARY KEY),
  chat_session_id (INTEGER REFERENCES chat_sessions(id)),
  role (TEXT NOT NULL), -- 'user' or 'assistant'
  content (TEXT NOT NULL),
  message_order (INTEGER NOT NULL),
  created_at (TIMESTAMP DEFAULT NOW())
}

-- Post-conversation feedback and ratings
conversation_feedback: {
  id (SERIAL PRIMARY KEY),
  session_id (TEXT NOT NULL),
  scenario_title (TEXT),
  overall_score (INTEGER), -- 1-5 rating
  future_conversations (TEXT), -- 'yes', 'maybe', 'no'
  comments (TEXT),
  created_at (TIMESTAMP DEFAULT NOW())
}
```

## 🎓 Available Communication Courses

### 1. How to Say No Without Burning Bridges
**Learning Objectives**: Master assertive communication while preserving relationships
- **Key Concepts**: Understanding boundary benefits and respectful communication
- **Step-by-Step Guide**: Practical techniques for graceful declination
- **Practice & Reflection**: Real-world application scenarios and common pitfall avoidance

### 2. Handling Manipulators & Guilt Trips
**Learning Objectives**: Recognize and counter manipulation tactics effectively
- **Understanding Boundary Crossers**: Identify psychological manipulation patterns
- **Enforcement Strategies**: Assertive communication without aggression
- **Relationship Evaluation**: When and how to disengage from toxic dynamics

### 3. Make Them Remember You
**Learning Objectives**: Create lasting positive impressions in all interactions
- **Connection Foundations**: Building authentic rapport and trust
- **Memorable Communication**: Techniques for standout conversations
- **Professional Networking**: Strategic relationship building

### 4. The Secret of Charismatic People
**Learning Objectives**: Develop magnetic personality traits and communication skills
- **Charisma Components**: Understanding what makes people naturally attractive
- **Social Influence**: Ethical persuasion and leadership communication
- **Authentic Confidence**: Building genuine self-assurance

### 5. Small Talk for Big Impact
**Learning Objectives**: Transform casual conversations into meaningful connections
- **Conversation Starters**: Natural and engaging opening techniques
- **Depth Building**: Moving beyond surface-level interactions
- **Professional Applications**: Networking and relationship building

### 6. Think Fast: How to Answer Tough Questions with Confidence
**Learning Objectives**: Develop quick thinking and articulate responses under pressure
- **Pressure Response**: Maintaining composure in challenging situations
- **Structured Thinking**: Frameworks for organizing thoughts quickly
- **Confident Delivery**: Projecting assurance even when uncertain

### 7. Talk, Persuade, Influence
**Learning Objectives**: Master ethical influence and persuasion techniques
- **Influence Psychology**: Understanding human decision-making processes
- **Persuasion Ethics**: Building win-win scenarios through communication
- **Leadership Communication**: Inspiring and motivating others effectively

## 👤 User Journey & Experience Flow

### 1. Discovery & Onboarding
- **Welcome Screen**: Platform introduction and value proposition
- **Lesson Selection**: Visual course overview with progress indicators
- **AI Tutor Introduction**: Meet Mr. Smart, your personalized communication coach

### 2. Structured Learning Experience
- **Lesson Navigation**: Multi-part content with seamless progression
- **Interactive Elements**: Engaging content delivery with multimedia support
- **Progress Tracking**: Real-time advancement indicators and achievement unlocks

### 3. AI-Powered Practice Sessions
- **Scenario Selection**: Choose from general or lesson-specific practice environments
- **Real-Time Conversations**: Dynamic dialogue with intelligent response suggestions
- **Adaptive Feedback**: Personalized coaching based on conversation performance

### 4. Assessment & Growth
- **Diagnostic Quizzes**: Communication style assessment and growth area identification
- **Post-Lesson Evaluation**: Knowledge retention testing and skill application
- **Continuous Improvement**: Ongoing progress tracking and personalized recommendations

## 🔧 Development Setup & Installation

### Prerequisites
- Node.js 20+ 
- PostgreSQL 16+
- OpenAI API Key

### Environment Setup
```bash
# Clone the repository
git clone [repository-url]
cd smartyme-platform

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Add your OpenAI API key and database URL

# Push database schema
npm run db:push

# Start development server
npm run dev
```

### Environment Variables
```env
OPENAI_API_KEY=your_openai_api_key_here
DATABASE_URL=postgresql://username:password@localhost:5432/smartyme
NODE_ENV=development
```

### Database Migration
```bash
# Push schema changes to database
npm run db:push

# Type checking
npm run check
```

## 🌐 API Endpoints

### Lesson Management
- `GET /api/lessons` - Retrieve all available lessons with full content
- `GET /api/lessons/:lessonId` - Get specific lesson with structured sections and content

### User Management
- `POST /api/users` - Create or update user (supports email or name)
- `GET /api/users/:email/sessions` - Get all chat sessions for a specific user

### AI Chat System
- `POST /api/chat/sessions` - Create new chat session with unique session ID
- `GET /api/chat/sessions/:sessionId` - Get session details by session ID
- `POST /api/chat/message` - Send message to AI tutor with webview support
- `POST /api/chat/sessions/:sessionId/abandon` - Mark session as abandoned
- `POST /api/chat/sessions/:sessionId/complete` - Mark session as completed with duration
- `GET /api/chat/sessions/:sessionId/messages` - Get all messages for a chat session

### Feedback & Analytics
- `POST /api/feedback` - Submit post-conversation feedback and ratings
- `GET /api/feedback/:sessionId` - Get feedback for a specific session
- `GET /api/analytics` - Get overall platform analytics and session statistics
- `GET /api/export` - Export all conversation data and analytics (JSON format)

### Admin Dashboard
- `POST /api/admin/login` - Admin authentication endpoint
- `GET /api/admin/metrics` - Comprehensive platform metrics for admin dashboard
- `GET /api/admin/comments` - Get all feedback comments with scenario context

### Webview Integration
*All endpoints support webview parameters for mobile app integration:*
- **URL Parameters**: `user_id`, `lesson_id`, `course_id` for webview entry
- **Database Tracking**: Automatic session tracking with source differentiation
- **Contained Experience**: Feedback loops maintain webview context

## 📱 Mobile-First Design Principles

### Responsive Architecture
- **Mobile-First CSS**: Tailwind utilities optimized for small screens
- **Touch-Friendly Interface**: Appropriately sized interactive elements
- **Progressive Enhancement**: Desktop features that enhance but don't require large screens
- **Performance Optimization**: Lazy loading and efficient bundle management

### Native App Experience
- **Gesture Support**: Swipe navigation and touch interactions
- **Offline Capability**: Service worker integration for limited offline functionality
- **App-Like Navigation**: Bottom navigation and slide transitions
- **Device Integration**: Camera access for future AR features

## 🔒 Security & Privacy

### Data Protection
- **Encrypted Communication**: HTTPS/WSS for all client-server communication
- **Session Security**: Secure session management with PostgreSQL store
- **API Rate Limiting**: Request throttling and abuse prevention
- **Input Validation**: Comprehensive Zod schema validation

### Privacy Compliance
- **Minimal Data Collection**: Only essential user information stored
- **Conversation Privacy**: Chat data encrypted and user-controlled
- **GDPR Considerations**: Right to deletion and data portability
- **Transparent Policies**: Clear communication about data usage

## 🚀 Deployment & Scaling

### Production Build
```bash
# Build for production
npm run build

# Start production server
npm run start
```

### Deployment Strategy
- **Auto-scaling**: Replit Deployments with automatic scaling
- **Database**: PostgreSQL with connection pooling
- **CDN Integration**: Static asset optimization and delivery
- **Monitoring**: Application performance and error tracking

### Performance Optimization
- **Code Splitting**: Route-based bundle optimization
- **Image Optimization**: Compressed assets and lazy loading
- **Caching Strategy**: Intelligent query caching with TanStack Query
- **Database Indexing**: Optimized queries for high-performance data retrieval

## 🤝 Contributing & Development Guidelines

### Code Quality Standards
- **TypeScript**: Strict type checking enabled
- **ESLint**: Consistent code formatting and error prevention
- **Component Architecture**: Reusable, composable React components
- **Testing Strategy**: Unit tests for critical business logic

### Development Workflow
1. **Feature Branches**: Isolated development with clear naming
2. **Code Review**: Peer review process for quality assurance
3. **Testing**: Comprehensive testing before deployment
4. **Documentation**: Keep README and inline documentation updated

## 🔧 Technical Implementation Details

### Webview Integration Architecture

#### Entry Point Flow
```
Mobile App → WebView URL → /webview?user_id=123&lesson_id=1&course_id=1
↓
Parameter Validation → Lesson Data Fetch → Scenario Selection
↓
AI Chat Session → Feedback Collection → Return to Mobile App Context
```

#### Database Tracking Strategy
```typescript
// Session Creation with Webview Context
const sessionData = {
  sessionId: generateUniqueId(),
  userEmail: effectiveUserEmail,
  scenarioTitle: scenario.title,
  scenarioPrompt: scenario.prompt,
  entryPoint: "webview",
  // Webview-specific fields
  userId: webviewParams.userId,        // Mobile app user ID
  lessonId: parseInt(lessonParams.lessonId), // Associated lesson
  courseId: parseInt(webviewParams.courseId), // Associated course
  source: "webview",                   // vs "web_app"
  webviewEntryTimestamp: new Date()
};
```

#### SessionStorage Management
```javascript
// Store webview parameters for navigation continuity
sessionStorage.setItem('webviewParams', JSON.stringify({
  userId: params.user_id,
  lessonId: params.lesson_id,
  courseId: params.course_id
}));

// Feedback page checks for webview context
const webviewParams = sessionStorage.getItem('webviewParams');
if (webviewParams) {
  // Redirect back to webview with original parameters
  setLocation(`/webview?user_id=${params.userId}&lesson_id=${params.lessonId}&course_id=${params.courseId}`);
}
```

### AI Conversation Flow

#### OpenAI Integration with Retry Logic
```typescript
async function callOpenAIWithRetry(messages: any[], maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: messages,
        max_tokens: 1000,
        temperature: 0.7
      });
      return response;
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}
```

#### Conversation Context Management
```typescript
// Build conversation history for AI
const conversationHistory = [
  { role: "system", content: scenario.prompt },
  ...existingMessages.map(msg => ({
    role: msg.role,
    content: msg.content
  })),
  { role: "user", content: userMessage }
];
```

## 📋 Current Project Status

### ✅ Completed Features
- **Full Web Application**: Complete lesson management and AI chat system
- **Webview Integration**: Mobile app integration with URL parameters and contained experience
- **Database Schema**: Comprehensive PostgreSQL schema with webview tracking
- **AI Tutor System**: GPT-4o powered conversation with intelligent suggestions
- **Analytics Dashboard**: Session tracking, feedback collection, and admin metrics
- **Cross-Platform Support**: Web app and mobile webview with unified data tracking

### 🔄 Recent Updates (June 2025)
- **Webview Implementation**: Complete mobile app integration with parameter passing
- **Database Enhancement**: Added webview-specific fields for cross-platform analytics
- **Feedback Flow**: Fixed navigation to maintain contained webview experience
- **Session Management**: Enhanced tracking for both web app and webview sources

## 📖 Usage Examples

### Mobile App Integration
```javascript
// React Native WebView integration
<WebView 
  source={{ 
    uri: 'https://your-app.replit.app/webview?user_id=123&lesson_id=1&course_id=1' 
  }}
  style={{ flex: 1 }}
  onNavigationStateChange={handleNavigationChange}
/>
```

### API Usage Examples
```javascript
// Create a new chat session
const response = await fetch('/api/chat/sessions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userEmail: 'user@example.com',
    scenarioTitle: 'Workplace Communication',
    scenarioPrompt: 'Practice professional boundary setting...'
  })
});

// Send message to AI tutor
const chatResponse = await fetch('/api/chat/message', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'I need help with saying no to extra work',
    sessionId: 'session_123',
    webviewParams: {
      userId: '123',
      lessonId: '1',
      courseId: '1'
    }
  })
});
```

## 📈 Future Roadmap

### Planned Features
- **Voice Integration**: Speech-to-text and text-to-speech capabilities
- **Video Scenarios**: Role-play with video-based interactions
- **Team Accounts**: Multi-user organizations and progress tracking
- **Advanced Analytics**: Detailed communication skill assessments
- **API Integrations**: Calendar scheduling and CRM connections

### Technical Enhancements
- **Real-Time Collaboration**: Multi-user practice scenarios
- **AI Model Fine-tuning**: Custom models for specialized communication domains
- **Native Mobile Apps**: iOS and Android applications with offline capabilities
- **Gamification**: Achievement systems and progress rewards

## 📞 Support & Community

### Getting Help
- **Documentation**: Comprehensive guides and API references
- **Community Forum**: User discussions and peer support
- **Bug Reports**: GitHub issues for technical problems
- **Feature Requests**: Community-driven feature prioritization

### Contact Information
- **Technical Support**: [support-email]
- **Business Inquiries**: [business-email]
- **Partnership Opportunities**: [partnerships-email]

---

**Built with ❤️ by the SmartyMe Team**

*Empowering human connection through intelligent communication training*