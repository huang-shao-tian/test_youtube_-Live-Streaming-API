# test_youtube_-Live-Streaming-API

## Environment Variables Setup

### Generating Session Secret

1. Generate a secure session secret by running:

```bash
openssl rand -hex 32
```

2. Add the generated secret to your `.env` file:

```bash
SESSION_SECRET=your_generated_secret
```

Important notes:
- Keep your session secret secure and never commit it to public repositories
- Use different secrets for development and production environments
- The secret should be at least 32 bytes (64 hexadecimal characters) long
