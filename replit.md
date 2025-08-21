# SmartyMe - Advanced AI Communication Skills Platform

## Overview
SmartyMe is an EdTech platform designed to enhance communication skills through AI-powered tutoring, interactive lessons, and immersive practice scenarios. It integrates structured learning with real-time AI conversation practice, offering a comprehensive development experience. The platform aims to provide a complete communication skills development experience, leveraging AI for personalized learning and feedback.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Changes (August 15, 2025)
- **✅ Deployment Fixed**: Resolved all health check failures for production deployment
- **✅ Frontend Serving**: Fixed root path to serve React frontend instead of API responses
- **✅ Health Endpoints**: Added multiple health check endpoints (`/health`, `/healthz`, `/ping`, `/status`, `/api/health`)
- **✅ Production Build**: Fixed static file serving with automated build script (`./build-production.sh`)
- **✅ Server Configuration**: Dynamic port binding for Cloud Run compatibility (`process.env.PORT || 5000`)
- **✅ Performance**: Optimized startup time with early health endpoints before full app initialization
- **✅ Flutter WebView Integration**: Complete native-like mobile experience with bidirectional communication bridges
- **✅ Mobile Optimization**: Touch-friendly interfaces, gesture support, and performance enhancements

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack Query
- **UI Framework**: Tailwind CSS with Radix UI components
- **Design**: Mobile-first, responsive layout
- **Build Tool**: Vite

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript
- **API Design**: RESTful with error handling and validation
- **Session Management**: Session-based authentication (PostgreSQL session store)
- **File Serving**: Static assets

### Database
- **Primary Database**: PostgreSQL with Drizzle ORM
- **Schema**: Relational design (users, lessons, chat sessions, messages, feedback)
- **Hosting**: Neon serverless PostgreSQL

### Key Components
- **Learning Management System**: Multi-part lesson structure with progress tracking, content organization (JSON/Markdown), and guided navigation.
- **AI Tutor Integration (Mr. Smart)**: OpenAI GPT-4o for communication coaching, scenario-based learning, dynamic responses, AI suggestions, and conversation analytics.
- **Interactive Practice Scenarios**: Role-play environments with real-time feedback for various communication situations (workplace, conflict resolution, etc.).
- **Data Flow**: Seamless mobile app integration via user_id, AI conversation flow with scenario selection and real-time chat, and robust database operations for user, session, and chat persistence.

## External Dependencies

### AI Services
- **OpenAI API**: GPT-4o model for AI conversations, with configured timeout handling, retry logic, and token management.

### Database Services
- **Neon PostgreSQL**: Serverless database hosting, connection pooling, and Drizzle Kit for migrations.

### Development Tools
- **Replit Integration**: Cloud development environment.
- **Asset Management**: Static file serving for media.
- **Environment Variables**: Secure management of API keys and database URLs.