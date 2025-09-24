import natural from 'natural';
import nlp from 'compromise';

const { WordTokenizer, PorterStemmer } = natural;

// Enhanced skill dictionary with categories and synonyms
const SKILL_CATEGORIES = {
  programming: {
    languages: ['javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'scala', 'r', 'matlab'],
    frameworks: ['react', 'vue', 'angular', 'node', 'express', 'django', 'flask', 'fastapi', 'spring', 'laravel', 'rails', 'asp.net', 'jquery', 'bootstrap'],
    databases: ['sql', 'mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch', 'cassandra', 'dynamodb', 'sqlite', 'oracle', 'sql server'],
    cloud: ['aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'ansible', 'jenkins', 'gitlab ci', 'github actions', 'lambda', 's3', 'ec2', 'rds'],
    tools: ['git', 'github', 'gitlab', 'jira', 'confluence', 'figma', 'postman', 'swagger', 'vscode', 'intellij', 'eclipse']
  },
  data: {
    ml: ['machine learning', 'deep learning', 'artificial intelligence', 'ai', 'ml', 'neural networks', 'tensorflow', 'pytorch', 'scikit-learn', 'keras', 'pandas', 'numpy'],
    analytics: ['data analysis', 'data science', 'statistics', 'sql', 'python', 'r', 'jupyter', 'tableau', 'power bi', 'excel', 'spss'],
    engineering: ['data engineering', 'etl', 'elt', 'airflow', 'dbt', 'spark', 'hadoop', 'kafka', 'streaming', 'data pipelines', 'data warehousing']
  },
  design: {
    ui: ['ui design', 'user interface', 'figma', 'sketch', 'adobe xd', 'wireframing', 'prototyping', 'design systems'],
    ux: ['ux design', 'user experience', 'user research', 'usability testing', 'information architecture', 'interaction design'],
    visual: ['photoshop', 'illustrator', 'indesign', 'canva', 'visual design', 'branding', 'typography', 'color theory']
  },
  business: {
    management: ['project management', 'product management', 'agile', 'scrum', 'kanban', 'jira', 'confluence', 'stakeholder management'],
    communication: ['presentation', 'public speaking', 'technical writing', 'documentation', 'training', 'mentoring'],
    leadership: ['team leadership', 'people management', 'strategic planning', 'budget management', 'vendor management']
  }
};

// Create a comprehensive skill dictionary
function buildSkillDictionary() {
  const allSkills = new Set();
  
  Object.values(SKILL_CATEGORIES).forEach(category => {
    Object.values(category).forEach(skillList => {
      skillList.forEach(skill => {
        allSkills.add(skill.toLowerCase());
        // Add variations
        allSkills.add(skill.replace(/\s+/g, '').toLowerCase());
        allSkills.add(skill.replace(/\s+/g, '-').toLowerCase());
        allSkills.add(skill.replace(/\s+/g, '_').toLowerCase());
      });
    });
  });
  
  return Array.from(allSkills);
}

// Extract skills using RAG approach
export function extractSkillsWithRAG(text) {
  const tokenizer = new WordTokenizer();
  const stemmer = PorterStemmer;
  
  // Clean and normalize text
  const cleanedText = text
    .toLowerCase()
    .replace(/[^\w\s\-\.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Tokenize and stem
  const tokens = tokenizer.tokenize(cleanedText);
  const stemmedTokens = tokens.map(token => stemmer.stem(token));
  
  // Use NLP to extract entities and phrases
  const doc = nlp(cleanedText);
  const entities = doc.people().out('array');
  const organizations = doc.organizations().out('array');
  const places = doc.places().out('array');
  
  // Extract technical terms and skills
  const skillDictionary = buildSkillDictionary();
  const foundSkills = new Set();
  
  // Direct matching
  skillDictionary.forEach(skill => {
    const patterns = [
      new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
      new RegExp(`${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i')
    ];
    
    patterns.forEach(pattern => {
      if (pattern.test(cleanedText)) {
        foundSkills.add(skill);
      }
    });
  });
  
  // Extract skills from context (e.g., "experienced in", "proficient with")
  const skillContextPatterns = [
    /(?:experienced in|proficient with|skilled in|expertise in|knowledge of|familiar with|worked with|used|utilized|implemented|developed|built|created|designed|managed|led|taught|trained in)\s+([^.,\n]+)/gi,
    /(?:technologies?|tools?|languages?|frameworks?|platforms?|systems?|software|programs?)\s*:?\s*([^.,\n]+)/gi,
    /(?:programming|development|engineering|design|management|analysis|data|cloud|web|mobile|frontend|backend|full.?stack)\s+(?:with|in|using|via)\s+([^.,\n]+)/gi
  ];
  
  skillContextPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(cleanedText)) !== null) {
      const contextSkills = match[1]
        .split(/[,;&|\/\-]/)
        .map(s => s.trim().toLowerCase())
        .filter(s => s.length > 1);
      
      contextSkills.forEach(skill => {
        // Check if it matches any skill in our dictionary
        skillDictionary.forEach(dictSkill => {
          if (skill.includes(dictSkill) || dictSkill.includes(skill)) {
            foundSkills.add(dictSkill);
          }
        });
      });
    }
  });
  
  // Extract years of experience for skills
  const experiencePattern = /(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s*)?(?:experience\s*)?(?:in|with|using)?\s*([^.,\n]+)/gi;
  let expMatch;
  while ((expMatch = experiencePattern.exec(cleanedText)) !== null) {
    const years = parseInt(expMatch[1]);
    const skillContext = expMatch[2].toLowerCase();
    
    skillDictionary.forEach(skill => {
      if (skillContext.includes(skill)) {
        foundSkills.add(skill);
      }
    });
  }
  
  // Categorize found skills
  const categorizedSkills = {
    programming: [],
    data: [],
    design: [],
    business: [],
    other: []
  };
  
  foundSkills.forEach(skill => {
    let categorized = false;
    Object.entries(SKILL_CATEGORIES).forEach(([category, subcategories]) => {
      Object.values(subcategories).forEach(skillList => {
        if (skillList.some(s => s.toLowerCase() === skill)) {
          categorizedSkills[category].push(skill);
          categorized = true;
        }
      });
    });
    
    if (!categorized) {
      categorizedSkills.other.push(skill);
    }
  });
  
  return {
    all: Array.from(foundSkills).sort(),
    categorized: categorizedSkills,
    confidence: calculateConfidence(foundSkills, cleanedText)
  };
}

function calculateConfidence(skills, text) {
  const skillCount = skills.size;
  const textLength = text.length;
  const skillDensity = skillCount / (textLength / 1000); // skills per 1000 chars
  
  // Higher confidence for more skills and better distribution
  let confidence = Math.min(skillDensity * 10, 100);
  
  // Boost confidence if skills are well-distributed across categories
  const categories = new Set();
  skills.forEach(skill => {
    Object.entries(SKILL_CATEGORIES).forEach(([category, subcategories]) => {
      Object.values(subcategories).forEach(skillList => {
        if (skillList.some(s => s.toLowerCase() === skill)) {
          categories.add(category);
        }
      });
    });
  });
  
  confidence += categories.size * 5;
  
  return Math.min(Math.round(confidence), 100);
}

// Extract additional resume metadata
export function extractResumeMetadata(text) {
  const doc = nlp(text);
  
  return {
    name: doc.people().first().text() || 'Unknown',
    email: text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g) || [],
    phone: text.match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g) || [],
    linkedin: text.match(/linkedin\.com\/in\/[a-zA-Z0-9-]+/g) || [],
    github: text.match(/github\.com\/[a-zA-Z0-9-]+/g) || [],
    yearsExperience: extractYearsExperience(text),
    education: extractEducation(text),
    certifications: extractCertifications(text)
  };
}

function extractYearsExperience(text) {
  const patterns = [
    /(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s*)?(?:experience|exp)/gi,
    /(?:experience|exp)\s*:?\s*(\d+)\+?\s*(?:years?|yrs?)/gi
  ];
  
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) {
      return parseInt(match[1]);
    }
  }
  
  return null;
}

function extractEducation(text) {
  const educationKeywords = ['university', 'college', 'bachelor', 'master', 'phd', 'degree', 'diploma', 'certificate'];
  const lines = text.split('\n');
  const educationLines = lines.filter(line => 
    educationKeywords.some(keyword => line.toLowerCase().includes(keyword))
  );
  
  return educationLines;
}

function extractCertifications(text) {
  const certKeywords = ['certified', 'certification', 'certificate', 'aws', 'azure', 'gcp', 'pmp', 'scrum', 'agile'];
  const lines = text.split('\n');
  const certLines = lines.filter(line => 
    certKeywords.some(keyword => line.toLowerCase().includes(keyword))
  );
  
  return certLines;
}
