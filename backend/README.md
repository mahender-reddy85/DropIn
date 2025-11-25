# DropIn Backend

## Setup

1. Copy `.env.example` to `.env` and update with your database credentials.

2. Install dependencies:

```
npm install
```

3. Create `uploads` directory in the backend root:

```
mkdir uploads
```

4. Start the server:

```
npm run dev
```

## API Endpoints

- `POST /upload` - Upload files (multipart/form-data, multiple files supported)
- `GET /download/:id` - Download file by ID (supports range requests)

More endpoints to be added.
