# Planka Webhook Receiver

A lightweight webhook receiver for [Planka](https://github.com/plankanban/planka) that collects events and sends email digest notifications.

## Features

- Receives webhooks from Planka
- Configurable event filters (choose which events trigger notifications)
- Email digest (collects events and sends periodic summary emails)
- Admin panel for configuration
- SQLite database (no external DB required)
- Docker/Podman ready

## Quick Start with Podman/Docker

1. Clone the repository:
```bash
git clone https://github.com/YOUR_USERNAME/planka-webhook-receiver.git
cd planka-webhook-receiver
```

2. Create environment file:
```bash
cp .env.example .env
# Edit .env and set JWT_SECRET to a random string
```

3. Start the container:
```bash
# With Podman
podman-compose up -d

# With Docker
docker-compose up -d
```

4. Access the admin panel at http://localhost:3000
   - Default password: `admin123` (change this in settings!)

5. Configure SMTP settings in the admin panel

6. Add the webhook URL to Planka:
   - Go to Planka Settings
   - Add webhook URL: `http://YOUR_HOST:3000/api/webhook`

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `JWT_SECRET` | Secret for JWT tokens | Required |
| `ADMIN_INITIAL_PASSWORD` | Initial admin password | `admin123` |
| `DATABASE_PATH` | SQLite database path | `./data/database.sqlite` |
| `WEBHOOK_SECRET` | Optional webhook secret | None |

### Webhook Secret (Optional)

For additional security, you can set a webhook secret:

1. Set `WEBHOOK_SECRET` in your `.env` file
2. Configure the same secret in Planka's webhook settings
3. The receiver will validate incoming webhooks against this secret

## Development

### Prerequisites

- Node.js 20+
- npm

### Setup

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Run in Development

```bash
# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Start frontend
cd frontend
npm run dev
```

Frontend will be available at http://localhost:5173 with hot reload.

### Build for Production

```bash
# Build frontend
cd frontend
npm run build

# Start backend (serves built frontend)
cd ../backend
npm start
```

## API Endpoints

### Public
- `POST /api/webhook` - Webhook endpoint for Planka

### Protected (requires authentication)
- `POST /api/auth/login` - Login
- `GET /api/auth/check` - Check authentication
- `GET/PUT /api/settings/smtp` - SMTP configuration
- `GET/PUT /api/settings/digest` - Digest settings
- `GET/POST/DELETE /api/settings/recipients` - Email recipients
- `GET/PUT /api/settings/filters` - Event filters
- `GET /api/events` - Event log

## Supported Planka Events

- `cardCreate` - Card created
- `cardUpdate` - Card updated
- `cardDelete` - Card deleted
- `commentCreate` - Comment added
- `cardMembershipCreate` - Member added to card
- `cardMembershipDelete` - Member removed from card
- `attachmentCreate` - Attachment added
- `listCreate` - List created
- `listUpdate` - List updated
- `listDelete` - List deleted

## GitHub Actions

The repository includes a GitHub Actions workflow that automatically builds and pushes Docker images to GitHub Container Registry (ghcr.io) on every push to `main` or when a tag is created.

### Using Pre-built Images

```yaml
services:
  planka-webhook-receiver:
    image: ghcr.io/YOUR_USERNAME/planka-webhook-receiver:latest
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      - JWT_SECRET=your-secret
      - ADMIN_INITIAL_PASSWORD=your-password
```

## License

MIT
