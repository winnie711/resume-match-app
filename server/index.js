import 'dotenv/config';
import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import multer from 'multer';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import { fileURLToPath } from 'url';
import { scoreCandidateAgainstJob, filterJobs } from './lib/match.js';
import { extractSkillsWithRAG, extractResumeMetadata } from './lib/ragParser.js';
import { analyzeResumeWithOpenAI, extractSkillsWithOpenAI } from './lib/openaiService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, '..')));

const upload = multer({ dest: path.join(__dirname, 'uploads') });

const jobs = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'lib', 'jobs.seed.json'), 'utf8')
  );

// Helper function to fetch jobs from RapidAPI
async function fetchJobsFromAPI(query = 'strategic finance') {
  const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || 'bbf542de61msh80975a9fd73449ep141d58jsn6fcfcea87149';
  const RAPIDAPI_HOST = 'jsearch.p.rapidapi.com';

  try {
    const params = new URLSearchParams({ query, page: '1', num_pages: '1' });
    const url = `https://${RAPIDAPI_HOST}/search?${params.toString()}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': RAPIDAPI_HOST
      }
    });

    if (!response.ok) {
      throw new Error(`RapidAPI error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const items = Array.isArray(data?.data) ? data.data : [];

    // Map JSearch fields to our client schema
    return items.map(item => {
      const city = item.job_city || '';
      const state = item.job_state || '';
      const country = item.job_country || '';
      const locParts = [city, state, country].filter(Boolean);
      return {
        id: item.job_id || `${item.employer_name || 'job'}-${Math.random().toString(36).slice(2, 8)}`,
        title: item.job_title || 'Untitled Role',
        company: item.employer_name || 'Unknown',
        location: locParts.join(', ') || (item.job_is_remote ? 'Remote' : '—'),
        description: item.job_description || '',
        // These are not available from the API; keep empty so UI still renders
        requiredSkills: [],
        preferredSkills: [],
        bonusSkills: []
      };
    });
  } catch (err) {
    console.error('Failed to fetch jobs from API, using seed data:', err.message);
    return jobs;
  }
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve the main app
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// RapidAPI-backed job search (JSearch)
app.get('/api/jobs', async (req, res) => {
  const { location, title, company, q } = req.query;

  // Build a single free-text query for JSearch
  const terms = [title, company, location, q].filter(Boolean).join(' ').trim() || 'strategic finance';

  // Always use API search with default "strategic finance" if no filters provided
  const apiJobs = await fetchJobsFromAPI(terms);
  res.json(apiJobs);
});

// New OpenAI-powered matching endpoint
app.post('/api/match-openai', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    let text = '';
    
    if (ext === '.pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      const uint8Array = new Uint8Array(dataBuffer);
      const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
      const pdf = await loadingTask.promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + ' ';
      }
      text = fullText.trim();
    } else if (ext === '.docx' || ext === '.doc') {
      const dataBuffer = fs.readFileSync(filePath);
      const result = await mammoth.extractRawText({ buffer: dataBuffer });
      text = result.value || '';
    } else if (ext === '.txt') {
      text = fs.readFileSync(filePath, 'utf8');
    } else {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'Unsupported file type. Upload PDF, DOCX, or TXT.' });
    }

    fs.unlink(filePath, () => {});

    // Use OpenAI for skill extraction
    const skillsResult = await extractSkillsWithOpenAI(text);
    
    if (!skillsResult.success) {
      return res.status(500).json({ error: 'Failed to extract skills: ' + skillsResult.error });
    }

    const resume = {
      text,
      skills: skillsResult.data.skills || [],
      categorizedSkills: skillsResult.data.categorizedSkills || {},
      experience: skillsResult.data.experience || {},
      education: skillsResult.data.education || {},
      summary: skillsResult.data.summary || ''
    };

    // Fetch jobs from API and analyze against each job using OpenAI
    const apiJobs = await fetchJobsFromAPI('strategic finance');
    const results = [];
    for (const job of apiJobs) {
      const jobDescription = `${job.title} at ${job.company}\n\n${job.description}\n\nRequired Skills: ${(job.requiredSkills || []).join(', ')}\nPreferred Skills: ${(job.preferredSkills || []).join(', ')}`;
      
      const analysisResult = await analyzeResumeWithOpenAI(text, jobDescription);
      
      if (analysisResult.success) {
        results.push({
          ...job,
          openaiMatch: analysisResult.data
        });
      } else {
        // Fallback to basic matching
        results.push({
          ...job,
          match: scoreCandidateAgainstJob(resume, job),
          openaiError: analysisResult.error
        });
      }
    }

    // Sort by OpenAI overall match score
    results.sort((a, b) => {
      const scoreA = a.openaiMatch?.overallMatch || a.match?.score || 0;
      const scoreB = b.openaiMatch?.overallMatch || b.match?.score || 0;
      return scoreB - scoreA;
    });

    res.json({ resume, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process resume' });
  }
});

app.post('/api/match', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    let text = '';
    if (ext === '.pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      const uint8Array = new Uint8Array(dataBuffer);
      const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
      const pdf = await loadingTask.promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + ' ';
      }
      text = fullText.trim();
    } else if (ext === '.docx' || ext === '.doc') {
      const dataBuffer = fs.readFileSync(filePath);
      const result = await mammoth.extractRawText({ buffer: dataBuffer });
      text = result.value || '';
    } else if (ext === '.txt') {
      text = fs.readFileSync(filePath, 'utf8');
    } else {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'Unsupported file type. Upload PDF, DOCX, or TXT.' });
    }

    fs.unlink(filePath, () => {});

    // Use RAG-based parsing
    const skillsData = extractSkillsWithRAG(text);
    const metadata = extractResumeMetadata(text);
    
    const resume = { 
      text, 
      skills: skillsData.all,
      skillsCategorized: skillsData.categorized,
      confidence: skillsData.confidence,
      metadata
    };

    // Fetch jobs from API and analyze against each job
    const apiJobs = await fetchJobsFromAPI('strategic finance');
    const results = apiJobs.map(job => ({
      ...job,
      match: scoreCandidateAgainstJob(resume, job)
    })).sort((a, b) => b.match.score - a.match.score);

    res.json({ resume, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process resume' });
  }
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  const uploadsDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  console.log(`Server running on http://localhost:${port}`);
});


