# Resume Match App

AI-powered resume matching application that uses OpenAI GPT-4 to analyze resumes and match them with job opportunities.

## Features

- Upload resumes in PDF, DOCX, or TXT format
- AI-powered skill extraction using OpenAI
- Intelligent job matching with detailed analysis
- Real-time job search using RapidAPI
- Modern, responsive web interface

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js, Express
- **AI**: OpenAI GPT-4
- **Job Data**: RapidAPI JSearch
- **Deployment**: Vercel

## Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key
- `RAPIDAPI_KEY`: Your RapidAPI key

## Local Development

1. Install dependencies:
   ```bash
   cd server
   npm install
   ```

2. Set environment variables:
   ```bash
   export OPENAI_API_KEY=your_key_here
   export RAPIDAPI_KEY=your_key_here
   ```

3. Start the server:
   ```bash
   npm start
   ```

4. Open http://localhost:4000 in your browser

## Deployment

This app is deployed on Vercel. The frontend is served statically and the backend runs as serverless functions.
