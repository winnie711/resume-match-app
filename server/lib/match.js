import _ from 'lodash';

const DEFAULT_SKILL_WEIGHTS = {
  required: 2.0,
  preferred: 1.0,
  bonus: 0.5
};

export function normalizeText(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9+.# ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractSkillsFromText(text) {
  const normalized = normalizeText(text);
  const dictionary = getSkillDictionary();

  const found = new Set();
  for (const skill of dictionary) {
    // Try multiple patterns for better matching
    const patterns = [
      new RegExp(`\\b${escapeRegExp(skill)}\\b`, 'i'),  // Word boundary
      new RegExp(`(^|\\s)${escapeRegExp(skill)}(\\s|$)`, 'i'),  // Space boundaries
      new RegExp(`${escapeRegExp(skill)}`, 'i')  // Anywhere in text
    ];
    
    for (const pattern of patterns) {
      if (pattern.test(normalized)) {
        found.add(skill);
        break; // Found with this pattern, no need to try others
      }
    }
  }
  
  // Debug logging
  console.log('Extracted text sample:', normalized.substring(0, 200));
  console.log('Found skills:', Array.from(found));
  
  return Array.from(found).sort();
}

export function scoreCandidateAgainstJob(resume, job) {
  const resumeSkills = new Set(resume.skills.map(s => s.toLowerCase()));
  const required = (job.requiredSkills || []).map(s => s.toLowerCase());
  const preferred = (job.preferredSkills || []).map(s => s.toLowerCase());
  const bonus = (job.bonusSkills || []).map(s => s.toLowerCase());

  const overlapRequired = required.filter(s => resumeSkills.has(s));
  const overlapPreferred = preferred.filter(s => resumeSkills.has(s));
  const overlapBonus = bonus.filter(s => resumeSkills.has(s));

  const missingRequired = required.filter(s => !resumeSkills.has(s));
  const missingPreferred = preferred.filter(s => !resumeSkills.has(s));

  const weightedHave = overlapRequired.length * DEFAULT_SKILL_WEIGHTS.required +
    overlapPreferred.length * DEFAULT_SKILL_WEIGHTS.preferred +
    overlapBonus.length * DEFAULT_SKILL_WEIGHTS.bonus;

  const weightedTotal = required.length * DEFAULT_SKILL_WEIGHTS.required +
    preferred.length * DEFAULT_SKILL_WEIGHTS.preferred +
    bonus.length * DEFAULT_SKILL_WEIGHTS.bonus;

  const score = weightedTotal > 0 ? Math.round((weightedHave / weightedTotal) * 100) : 0;

  return {
    score,
    overlap: {
      required: overlapRequired,
      preferred: overlapPreferred,
      bonus: overlapBonus
    },
    missing: {
      required: missingRequired,
      preferred: missingPreferred
    }
  };
}

export function filterJobs(jobs, { location, title, company, q }) {
  const needle = normalizeText(q || '');
  return jobs.filter(job => {
    const locationOk = !location || job.location.toLowerCase().includes(location.toLowerCase());
    const titleOk = !title || job.title.toLowerCase().includes(title.toLowerCase());
    const companyOk = !company || job.company.toLowerCase().includes(company.toLowerCase());

    let textOk = true;
    if (needle) {
      const haystack = normalizeText(`${job.title} ${job.company} ${job.location} ${job.description}`);
      textOk = haystack.includes(needle);
    }
    return locationOk && titleOk && companyOk && textOk;
  });
}

function getSkillDictionary() {
  return [
    'python','javascript','typescript','java','c++','c#','sql','nosql','mongodb','postgres','mysql','redis',
    'react','vue','angular','node','express','django','flask','fastapi','spring','graphql','rest','docker','kubernetes',
    'aws','azure','gcp','lambda','s3','ec2','cloudformation','terraform','git','github','gitlab','ci','cd','jenkins',
    'ml','machine learning','deep learning','pytorch','tensorflow','sklearn','nlp','llm','prompt engineering',
    'data engineering','etl','airflow','dbt','spark','hadoop','kafka',
    'product management','agile','scrum','kanban','jira','figma','design','ui','ux','unit testing','integration testing'
  ];
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}


