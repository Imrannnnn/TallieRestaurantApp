# Docker Setup Guide

## Quick Start

### Prerequisites
- Docker and Docker Compose installed
- Port 3000 available on your machine

### Development Mode (Hot Reload)

Start the application with hot reload enabled:

```bash
docker-compose up --build
```

This will:
- Build the Docker image
- Start the application container
- Mount your local code for hot reload
- Use an in-memory database
- Show all logs in the terminal

Access the API at: `http://localhost:3000`

Stop the containers:
```bash
docker-compose down
```

### Production Mode (Persistent Database)

Start with a persistent SQLite database:

```bash
docker-compose -f docker-compose.prod.yml up -d
```

This will:
- Build the production image
- Start the application with persistent storage
- Create a volume for the database
- Run in detached mode (background)

View logs:
```bash
docker logs restaurant-api-prod -f
```

Stop the containers:
```bash
docker-compose -f docker-compose.prod.yml down
```

Clean up volumes (careful - deletes data):
```bash
docker-compose -f docker-compose.prod.yml down -v
```

## Docker Commands Reference

### Build Image Manually
```bash
docker build -t restaurant-api:latest .
```

### Run Container Directly
```bash
# Development (in-memory database)
docker run -p 3000:3000 -e NODE_ENV=development restaurant-api:latest

# Production (persistent database)
docker run -p 3000:3000 -e NODE_ENV=production -v restaurant-db:/data restaurant-api:latest
```

### View Container Logs
```bash
docker logs <container-name> -f
```

### Inspect Running Container
```bash
docker ps                    # List running containers
docker exec -it <container-id> sh   # Open shell in container
```

### Test the API Inside Container
```bash
docker exec <container-id> npm test
```

## Health Check

The container includes a health check that verifies the API is responding:

```bash
docker inspect restaurant-api
```

Look for the `Health` section in the output.

## Database Persistence

### Development Mode
- Uses in-memory SQLite database
- Data is lost when container stops
- Good for testing and development

### Production Mode
- Uses file-based SQLite database at `/data/restaurant.db`
- Database persists in a Docker volume
- Data survives container restarts

View the database volume:
```bash
docker volume ls
docker volume inspect tallie_db-volume
```

## Environment Variables

### Development
```yaml
NODE_ENV: development
DB_PATH: :memory:
```

### Production
```yaml
NODE_ENV: production
DB_PATH: /data/restaurant.db
```

Customize by creating a `.env` file:
```
NODE_ENV=production
DB_PATH=/data/restaurant.db
PORT=3000
```

Then pass it to Docker:
```bash
docker run --env-file .env -p 3000:3000 restaurant-api:latest
```

## Useful Docker Compose Commands

```bash
# Start services
docker-compose up

# Start in background
docker-compose up -d

# Rebuild images
docker-compose up --build

# View logs
docker-compose logs -f

# Run one-off commands
docker-compose exec app npm test
docker-compose exec app npm run dev

# Stop services
docker-compose down

# Remove volumes (careful!)
docker-compose down -v

# Rebuild and clean start
docker-compose down && docker-compose up --build
```

## Troubleshooting

### Port Already in Use
If port 3000 is already in use:
```bash
# Change port in docker-compose.yml
# ports:
#   - "3001:3000"

# Or kill the process
lsof -i :3000
kill -9 <PID>
```

### Volume Issues
Clear Docker volumes and start fresh:
```bash
docker-compose down -v
docker volume prune
docker-compose up --build
```

### Container Won't Start
Check logs:
```bash
docker-compose logs app
```

### Database Issues
Check database file permissions:
```bash
docker exec restaurant-api-prod ls -la /data/
```

## Image Optimization

### Current Image Size
The image uses Alpine Linux (base: 40MB) + Node 18 (~150MB) = ~190MB

### Multi-Stage Build Benefits
- Doesn't include npm cache in final image
- Doesn't include dev dependencies
- Smaller overall image size

### Further Optimization (Optional)
For even smaller images, consider:
```dockerfile
FROM node:18-alpine AS prod-deps
# ... only install production dependencies ...

FROM node:18-alpine
# Copy only production node_modules
```

## Networking

Containers can communicate on the `restaurant-network` bridge network.

To access the API from another container:
```
http://app:3000
```

To access the API from your machine:
```
http://localhost:3000
```

## Security Notes

✅ Container runs as non-root user (nodejs)
✅ Minimal image size reduces attack surface
✅ Health check ensures container responsiveness
✅ Restart policy prevents cascading failures

To further improve security:
- Use secrets management for sensitive data
- Run behind a reverse proxy (nginx, traefik)
- Set resource limits (memory, CPU)
- Use read-only filesystem where possible

## Next Steps

1. Test locally with docker-compose
2. Push image to container registry (Docker Hub, ECR, GCR)
3. Deploy to container orchestration platform (Kubernetes, Docker Swarm)
4. Set up CI/CD pipeline for automated builds

Example Docker registry commands:
```bash
# Tag image
docker tag restaurant-api:latest myrepo/restaurant-api:latest

# Push to registry
docker push myrepo/restaurant-api:latest

# Pull from registry
docker pull myrepo/restaurant-api:latest
```
