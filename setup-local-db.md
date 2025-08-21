# Налаштування локальної бази даних

## База даних
Використовується **PostgreSQL** з наступними таблицями:
- `users` - користувачі
- `chat_sessions` - сесії чатів
- `chat_messages` - повідомлення в чатах
- `conversation_feedback` - відгуки про розмови

## Встановлення PostgreSQL локально

### 1. Встановлення PostgreSQL на macOS:
```bash
# Через Homebrew
brew install postgresql@16
brew services start postgresql@16

# Або завантажте Postgres.app з https://postgresapp.com/
```

### 2. Створення бази даних:
```bash
# Підключіться до PostgreSQL
psql postgres

# Створіть базу даних
CREATE DATABASE smartyme_local;

# Створіть користувача (опціонально)
CREATE USER smartyme_user WITH PASSWORD 'smartyme_password';
GRANT ALL PRIVILEGES ON DATABASE smartyme_local TO smartyme_user;

# Вийдіть з psql
\q
```

### 3. Налаштування .env файлу:
```env
# Локальна база даних PostgreSQL
DATABASE_URL=postgresql://smartyme_user:smartyme_password@localhost:5432/smartyme_local

# Або простіший варіант без користувача:
DATABASE_URL=postgresql://localhost:5432/smartyme_local

# OpenAI API ключ (потрібен для AI функціоналу)
OPENAI_API_KEY=sk-...ваш_ключ...

# Адмін доступ (опціонально)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

### 4. Створення таблиць через Drizzle:
```bash
# Встановіть залежності
npm install

# Створіть таблиці в базі даних
npm run db:push
```

### 5. Запуск проекту:
```bash
# Запустіть сервер розробки
npm run dev
```

## Структура таблиць

### users
- `id` - SERIAL PRIMARY KEY
- `user_id` - TEXT NOT NULL UNIQUE (ID з мобільного додатку)
- `email` - TEXT (опціонально)
- `created_at` - TIMESTAMP
- `last_active_at` - TIMESTAMP

### chat_sessions
- `id` - SERIAL PRIMARY KEY
- `session_id` - TEXT NOT NULL UNIQUE
- `user_id` - TEXT NOT NULL
- `scenario_title` - TEXT NOT NULL
- `scenario_prompt` - TEXT NOT NULL
- `message_count` - INTEGER DEFAULT 0
- `is_abandoned` - BOOLEAN DEFAULT FALSE
- `abandoned_at` - TIMESTAMP
- `completed_at` - TIMESTAMP
- `duration` - INTEGER
- `entry_point` - TEXT
- `lesson_id` - INTEGER
- `course_id` - INTEGER
- `source` - TEXT DEFAULT 'webview'
- `webview_entry_timestamp` - TIMESTAMP
- `user_email` - TEXT
- `created_at` - TIMESTAMP

### chat_messages
- `id` - SERIAL PRIMARY KEY
- `chat_session_id` - INTEGER REFERENCES chat_sessions(id)
- `role` - TEXT NOT NULL ('user' або 'assistant')
- `content` - TEXT NOT NULL
- `message_order` - INTEGER NOT NULL
- `created_at` - TIMESTAMP

### conversation_feedback
- `id` - SERIAL PRIMARY KEY
- `session_id` - TEXT NOT NULL
- `scenario_title` - TEXT
- `overall_score` - INTEGER (1-5)
- `future_conversations` - TEXT ('yes', 'maybe', 'no')
- `comments` - TEXT
- `created_at` - TIMESTAMP

## Альтернатива: Docker

Якщо хочете використовувати Docker:

```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: smartyme_local
      POSTGRES_USER: smartyme_user
      POSTGRES_PASSWORD: smartyme_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

Запуск:
```bash
docker-compose up -d
```