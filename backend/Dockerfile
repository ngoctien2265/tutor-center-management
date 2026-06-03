FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy project
COPY . .

# Expose port
EXPOSE 8000

# Create directories for static and media files
RUN mkdir -p staticfiles media

# Run migrations and start server
CMD ["sh", "-c", "python manage.py makemigrations && python manage.py migrate && python manage.py seed_db --clear && python manage.py collectstatic --noinput && gunicorn wsgi:application --bind 0.0.0.0:8000"]
