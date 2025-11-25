# DropIn

A modern, secure file transfer application that allows users to upload files and share them via unique codes or QR codes. Built with a Node.js backend and a responsive HTML/CSS/JavaScript frontend.

## Features

- **File Upload**: Support for multiple file types with drag-and-drop interface
- **Secure Sharing**: Generate unique 5-digit codes for file access
- **QR Code Integration**: Scan QR codes to quickly access shared files
- **Expiration**: Files automatically expire after 1 hour for security
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Dark Mode**: Toggle between light and dark themes
- **Progress Tracking**: Real-time upload and download progress

## Tech Stack

### Frontend
- HTML5
- CSS3 (with CSS Variables for theming)
- JavaScript (ES6+)
- QRCode.js for QR code generation
- Html5-QRCode for QR code scanning

### Backend
- Node.js
- Express.js
- Multer for file handling
- UUID for unique code generation
- CORS for cross-origin requests

## Project Structure

```
SwiftShare/
├── backend/
│   ├── index.js          # Main server file
│   ├── package.json      # Backend dependencies         # File metadata storage
│   └── README.md         # Backend-specific documentation
├── frontend/
│   ├── index.html        # Main HTML file
│   ├── script.js         # Frontend JavaScript
│   ├── styles.css        # CSS styles
│   └── vercel.json       # Vercel deployment config
├── package.json          # Root package.json (if needed)
└── README.md             # This file
```

## Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Ensure the `uploads` and `metadata` directories exist (they should be created automatically by the server).

4. Start the development server:
   ```bash
   npm start
   ```

The backend will run on `http://localhost:3001` by default.

### Frontend Setup

The frontend is a static site that can be served from any web server or deployed to platforms like Vercel.

1. For local development, you can use a simple HTTP server:
   ```bash
   cd frontend
   python -m http.server 8000
   # or
   npx serve .
   ```

2. Open `http://localhost:8000` in your browser.

For production deployment, the frontend can be deployed to Vercel, Netlify, or any static hosting service.

## Usage

1. **Sending Files**:
   - Drag and drop files into the upload zone or click to browse
   - Click "Generate Code" to upload files and get a shareable code
   - Share the code or QR code with recipients

2. **Receiving Files**:
   - Enter the 5-digit code in the "Receive" tab
   - Or scan the QR code using the "Scan QR Code" button
   - Download individual files or view all files in the group

## API Endpoints

### Upload Files
- **POST** `/api/upload`
- Accepts multipart/form-data with `files` field
- Returns a JSON object with `code` property

### Get File Info
- **GET** `/api/info/:code`
- Returns file metadata for the given code

### Download File
- **GET** `/api/download/:code/:filename`
- Downloads a specific file

### Download All Files
- **GET** `/api/download/:code`
- Returns metadata for all files in the group

## Configuration

### Environment Variables
Create a `.env` file in the backend directory with:
```
PORT=3001
```

### File Size Limits
- Maximum file size: 100MB (configurable in frontend)
- Files expire after 1 hour

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the ISC License.

## Support

For issues or questions, please open an issue on GitHub.
