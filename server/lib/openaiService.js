import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const RESUME_MATCHING_PROMPT = `You are an AI resume-matching assistant. Your task is to compare a candidate's resume to a job description and generate a match percentage score.

Instructions:
1. Identify the key skills, qualifications, and experiences required by the job description.
2. Extract relevant skills, achievements, and experience from the candidate's resume.
3. Compare each requirement to the resume:
   - Exact match → 100%
   - Partial match → 50–75%
   - Weak or no match → 0–25%
4. Assign category scores for:
   - Education
   - Experience / Years
   - Hard Skills (finance, analytics, software)
   - Soft Skills (communication, leadership)
   - Domain / Industry knowledge
5. Calculate an overall weighted match score (0–100%).
6. Output a table with:
   - Requirement / Skill
   - Resume Evidence
   - Match Score (%)
7. At the end, provide an Overall Match (%).

Job Description:
{jobDescription}

Resume:
{resume}

Please provide your analysis in the following JSON format:
{
  "overallMatch": 85,
  "categoryScores": {
    "education": 90,
    "experience": 80,
    "hardSkills": 85,
    "softSkills": 75,
    "domainKnowledge": 90
  },
  "detailedMatches": [
    {
      "requirement": "JavaScript proficiency",
      "resumeEvidence": "3 years of React development, Node.js backend experience",
      "matchScore": 90
    }
  ],
  "missingSkills": ["TypeScript", "AWS"],
  "strengths": ["Strong React experience", "Good problem-solving skills"],
  "recommendations": ["Consider learning TypeScript", "Gain AWS certification"]
}`;

export async function analyzeResumeWithOpenAI(resumeText, jobDescription) {
  try {
    const prompt = RESUME_MATCHING_PROMPT
      .replace('{jobDescription}', jobDescription)
      .replace('{resume}', resumeText);

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert resume matching assistant. Always respond with valid JSON format as specified in the prompt."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });

    const response = completion.choices[0].message.content;
    
    // Try to parse JSON response
    try {
      const parsedResponse = JSON.parse(response);
      return {
        success: true,
        data: parsedResponse
      };
    } catch (parseError) {
      // If JSON parsing fails, try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedResponse = JSON.parse(jsonMatch[0]);
        return {
          success: true,
          data: parsedResponse
        };
      }
      
      // Fallback: return the raw response
      return {
        success: false,
        error: "Failed to parse OpenAI response as JSON",
        rawResponse: response
      };
    }
  } catch (error) {
    console.error('OpenAI API Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

export async function extractSkillsWithOpenAI(resumeText) {
  try {
    const prompt = `Extract and categorize all relevant skills from this resume. Return a JSON object with the following structure:

{
  "skills": ["skill1", "skill2", "skill3"],
  "categorizedSkills": {
    "programming": ["JavaScript", "Python"],
    "frameworks": ["React", "Node.js"],
    "databases": ["MySQL", "MongoDB"],
    "cloud": ["AWS", "Docker"],
    "tools": ["Git", "VS Code"],
    "softSkills": ["Leadership", "Communication"],
    "certifications": ["AWS Certified", "PMP"],
    "languages": ["English", "Spanish"]
  },
  "experience": {
    "totalYears": 5,
    "relevantExperience": 3
  },
  "education": {
    "degree": "Bachelor of Computer Science",
    "institution": "MIT",
    "graduationYear": 2020
  },
  "summary": "Brief 2-3 sentence summary of the candidate's profile"
}

Resume:
${resumeText}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert resume parser. Extract skills and information accurately. Always respond with valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.2,
      max_tokens: 1500
    });

    const response = completion.choices[0].message.content;
    
    try {
      const parsedResponse = JSON.parse(response);
      return {
        success: true,
        data: parsedResponse
      };
    } catch (parseError) {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedResponse = JSON.parse(jsonMatch[0]);
        return {
          success: true,
          data: parsedResponse
        };
      }
      
      return {
        success: false,
        error: "Failed to parse OpenAI response as JSON",
        rawResponse: response
      };
    }
  } catch (error) {
    console.error('OpenAI Skills Extraction Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
