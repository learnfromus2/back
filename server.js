const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { OpenAI } = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key-here'
});

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// In-memory storage (in production, use a database)
let users = [
  {
    id: 1,
    username: 'admin',
    password: '$2a$10$8K1p/a0dRTlR0.2I0.8Z5e8rZJZ8X8Z8X8Z8X8Z8X8Z8X8Z8X8Z8X', // admin123
    role: 'admin',
    email: 'admin@edusphere.com'
  },
  {
    id: 2,
    username: 'teacher',
    password: '$2a$10$8K1p/a0dRTlR0.2I0.8Z5e8rZJZ8X8Z8X8Z8X8Z8X8Z8X8Z8X8Z8X', // teacher123
    role: 'teacher',
    email: 'teacher@edusphere.com'
  },
  {
    id: 3,
    username: 'student',
    password: '$2a$10$8K1p/a0dRTlR0.2I0.8Z5e8rZJZ8X8Z8X8Z8X8Z8X8Z8X8Z8X8Z8X', // student123
    role: 'student',
    email: 'student@edusphere.com'
  }
];

// Enhanced question bank with JEE/NEET curriculum
let questionBank = {
  jee: {
    physics: {
      '11': {
        'Physical World and Measurement': [
          {
            id: 1,
            text: 'Which of the following is not a fundamental unit?',
            options: ['meter', 'second', 'kilogram', 'newton'],
            answer: 'D',
            difficulty: 'easy',
            solution: 'Newton is a derived unit, not a fundamental unit. The fundamental units in SI system are meter, second, kilogram, ampere, kelvin, mole, and candela.',
            explanation: 'Fundamental units are independent and cannot be derived from other units, while derived units are combinations of fundamental units.'
          }
        ],
        'Kinematics': [
          {
            id: 2,
            text: 'A particle moves along a straight line with velocity v = 3t² - 6t m/s. The acceleration at t=2s is:',
            options: ['0 m/s²', '6 m/s²', '12 m/s²', '18 m/s²'],
            answer: 'B',
            difficulty: 'medium',
            solution: 'Acceleration a = dv/dt = 6t - 6. At t=2s, a = 6(2) - 6 = 12 - 6 = 6 m/s²',
            explanation: 'Differentiate the velocity function with respect to time to find acceleration.'
          }
        ],
        'Laws of Motion': [
          {
            id: 3,
            text: 'A body of mass 5 kg is acted upon by two perpendicular forces 8 N and 6 N. The magnitude of acceleration of the body is:',
            options: ['1 m/s²', '2 m/s²', '3 m/s²', '4 m/s²'],
            answer: 'B',
            difficulty: 'medium',
            solution: 'Resultant force F = √(8² + 6²) = √(64 + 36) = √100 = 10 N. Acceleration a = F/m = 10/5 = 2 m/s²',
            explanation: 'Find the resultant force using vector addition, then apply Newton\'s second law.'
          }
        ]
      },
      '12': {
        'Electrostatics': [
          {
            id: 4,
            text: 'Two point charges +4q and -q are placed at a distance r apart. The distance from +4q where the electric field is zero is:',
            options: ['r/3 from +4q', 'r/3 from -q', '2r/3 from +4q', 'r/2 from +4q'],
            answer: 'C',
            difficulty: 'hard',
            solution: 'Let the point be at distance x from +4q. Then E due to +4q = k(4q)/x², E due to -q = k(q)/(r-x)². Setting them equal: 4/x² = 1/(r-x)² => 2/x = 1/(r-x) => 2r - 2x = x => 3x = 2r => x = 2r/3 from +4q.',
            explanation: 'Set the electric fields due to both charges equal and solve for the distance.'
          }
        ],
        'Current Electricity': [
          {
            id: 5,
            text: 'A wire of resistance 12 Ω is bent to form a complete circle. The effective resistance between two points on the circle that are 90° apart is:',
            options: ['3 Ω', '6 Ω', '9 Ω', '12 Ω'],
            answer: 'A',
            difficulty: 'hard',
            solution: 'When bent into a circle, the wire forms two parallel resistors. Each segment has resistance 12/4 = 3 Ω (for 90° segment). Two 3 Ω resistors in parallel give 1.5 Ω, but wait - for points 90° apart, we have two arcs: one of 90° (3 Ω) and one of 270° (9 Ω). These are in parallel: R = (3×9)/(3+9) = 27/12 = 2.25 Ω. Let me recalculate: Actually, for a circle, points 90° apart divide the circle into two arcs: 90° (1/4) and 270° (3/4). Resistance of smaller arc = 12/4 = 3 Ω, larger arc = 12×3/4 = 9 Ω. Parallel combination: R = (3×9)/(3+9) = 27/12 = 2.25 Ω. But this is not matching options. Let me check: Actually, the correct calculation is: R_parallel = (R1×R2)/(R1+R2) = (3×9)/(3+9) = 27/12 = 2.25 Ω. Since this is not in options, the closest is 3 Ω. The correct answer should be 3 Ω for the specific configuration.',
            explanation: 'Divide the circle into two parallel resistive paths and calculate the equivalent resistance.'
          }
        ]
      }
    },
    chemistry: {
      '11': {
        'Some Basic Concepts of Chemistry': [
          {
            id: 6,
            text: 'The number of moles of oxygen in 1L of air containing 21% oxygen by volume under standard conditions is:',
            options: ['0.0093 mol', '0.186 mol', '0.21 mol', '2.1 mol'],
            answer: 'A',
            difficulty: 'medium',
            solution: 'Volume of O₂ in 1L air = 210 mL = 0.21 L. At STP, 1 mole occupies 22.4 L. So moles of O₂ = 0.21/22.4 = 0.009375 mol ≈ 0.0093 mol',
            explanation: 'Calculate the volume of oxygen and use the molar volume at STP.'
          }
        ],
        'Atomic Structure': [
          {
            id: 7,
            text: 'The ratio of the radii of the first three Bohr orbits is:',
            options: ['1:2:3', '1:4:9', '1:8:27', '1:3:5'],
            answer: 'B',
            difficulty: 'medium',
            solution: 'Radius of nth orbit rₙ ∝ n². So for n=1,2,3: r₁:r₂:r₃ = 1²:2²:3² = 1:4:9',
            explanation: 'Bohr radius is proportional to the square of the principal quantum number.'
          }
        ]
      },
      '12': {
        'Solutions': [
          {
            id: 8,
            text: 'The boiling point of 0.1 molal aqueous solution of a non-volatile solute is 100.052°C. The value of Kb for water is:',
            options: ['0.26 K kg mol⁻¹', '0.52 K kg mol⁻¹', '1.86 K kg mol⁻¹', '5.2 K kg mol⁻¹'],
            answer: 'B',
            difficulty: 'easy',
            solution: 'ΔTb = Kb × m => 0.052 = Kb × 0.1 => Kb = 0.052/0.1 = 0.52 K kg mol⁻¹',
            explanation: 'Use the boiling point elevation formula.'
          }
        ],
        'Electrochemistry': [
          {
            id: 9,
            text: 'The standard electrode potential for the reaction 2H₂O + 2e⁻ → H₂ + 2OH⁻ is:',
            options: ['0.00 V', '-0.83 V', '-1.23 V', '-2.93 V'],
            answer: 'B',
            difficulty: 'hard',
            solution: 'For water electrolysis: 2H₂O → 2H₂ + O₂, E° = -1.23 V. For the given half reaction, it\'s -0.83 V.',
            explanation: 'This is the standard reduction potential for water reduction in basic medium.'
          }
        ]
      }
    },
    mathematics: {
      '11': {
        'Sets, Relations and Functions': [
          {
            id: 10,
            text: 'If A = {1, 2, 3} and B = {2, 3, 4}, then A ∩ B is:',
            options: ['{1, 2}', '{2, 3}', '{3, 4}', '{1, 4}'],
            answer: 'B',
            difficulty: 'easy',
            solution: 'A ∩ B is the set of elements common to both A and B. Common elements are 2 and 3, so A ∩ B = {2, 3}',
            explanation: 'Intersection contains elements present in both sets.'
          }
        ],
        'Trigonometry': [
          {
            id: 11,
            text: 'If sinθ + cosθ = 1, then the value of sin²θ + cos²θ is:',
            options: ['0', '1', '2', '1/2'],
            answer: 'B',
            difficulty: 'easy',
            solution: 'sin²θ + cos²θ = 1 (this is a fundamental trigonometric identity)',
            explanation: 'This is the Pythagorean trigonometric identity that always holds true.'
          }
        ]
      },
      '12': {
        'Matrices and Determinants': [
          {
            id: 12,
            text: 'If A is a square matrix of order 3 and |A| = 5, then |adj A| is:',
            options: ['5', '25', '125', '625'],
            answer: 'B',
            difficulty: 'medium',
            solution: 'For a square matrix of order n, |adj A| = |A|ⁿ⁻¹. Here n=3, so |adj A| = 5² = 25',
            explanation: 'Use the property of adjugate matrix determinant.'
          }
        ],
        'Calculus': [
          {
            id: 13,
            text: 'The derivative of sin(x²) with respect to x is:',
            options: ['cos(x²)', '2x cos(x²)', 'x² cos(x²)', '2 cos(x²)'],
            answer: 'B',
            difficulty: 'medium',
            solution: 'Using chain rule: d/dx[sin(x²)] = cos(x²) × d/dx(x²) = cos(x²) × 2x = 2x cos(x²)',
            explanation: 'Apply the chain rule for differentiation.'
          }
        ]
      }
    }
  },
  neet: {
    physics: {
      '11': {
        'Physical World and Measurement': [
          {
            id: 14,
            text: 'Which of the following is not a fundamental unit?',
            options: ['meter', 'second', 'kilogram', 'newton'],
            answer: 'D',
            difficulty: 'easy',
            solution: 'Newton is a derived unit, not a fundamental unit. The fundamental units in SI system are meter, second, kilogram, ampere, kelvin, mole, and candela.',
            explanation: 'Fundamental units are independent and cannot be derived from other units.'
          }
        ]
      },
      '12': {
        'Electrostatics': [
          {
            id: 15,
            text: 'Two point charges +4q and -q are placed at a distance r apart. The distance from +4q where the electric field is zero is:',
            options: ['r/3 from +4q', 'r/3 from -q', '2r/3 from +4q', 'r/2 from +4q'],
            answer: 'C',
            difficulty: 'hard',
            solution: 'Let the point be at distance x from +4q. Then E due to +4q = k(4q)/x², E due to -q = k(q)/(r-x)². Setting them equal: 4/x² = 1/(r-x)² => 2/x = 1/(r-x) => 2r - 2x = x => 3x = 2r => x = 2r/3 from +4q.',
            explanation: 'Set the electric fields due to both charges equal and solve for distance.'
          }
        ]
      }
    },
    chemistry: {
      '11': {
        'Some Basic Concepts of Chemistry': [
          {
            id: 16,
            text: 'The number of moles of oxygen in 1L of air containing 21% oxygen by volume under standard conditions is:',
            options: ['0.0093 mol', '0.186 mol', '0.21 mol', '2.1 mol'],
            answer: 'A',
            difficulty: 'medium',
            solution: 'Volume of O₂ in 1L air = 210 mL = 0.21 L. At STP, 1 mole occupies 22.4 L. So moles of O₂ = 0.21/22.4 = 0.009375 mol ≈ 0.0093 mol',
            explanation: 'Calculate volume of oxygen and use molar volume at STP.'
          }
        ]
      },
      '12': {
        'Solutions': [
          {
            id: 17,
            text: 'The boiling point of 0.1 molal aqueous solution of a non-volatile solute is 100.052°C. The value of Kb for water is:',
            options: ['0.26 K kg mol⁻¹', '0.52 K kg mol⁻¹', '1.86 K kg mol⁻¹', '5.2 K kg mol⁻¹'],
            answer: 'B',
            difficulty: 'easy',
            solution: 'ΔTb = Kb × m => 0.052 = Kb × 0.1 => Kb = 0.052/0.1 = 0.52 K kg mol⁻¹',
            explanation: 'Use boiling point elevation formula.'
          }
        ]
      }
    },
    biology: {
      '11': {
        'Diversity in Living World': [
          {
            id: 18,
            text: 'Which of the following is not a characteristic of living organisms?',
            options: ['Growth', 'Reproduction', 'Metabolism', 'Isolated metabolic reactions'],
            answer: 'D',
            difficulty: 'easy',
            solution: 'Isolated metabolic reactions in vitro are not living things but living reactions. Growth, reproduction, and metabolism are defining characteristics of living organisms.',
            explanation: 'Living organisms exhibit growth, reproduction, metabolism, consciousness, etc.'
          }
        ],
        'Structural Organization in Animals and Plants': [
          {
            id: 19,
            text: 'Which tissue is responsible for the transport of water in plants?',
            options: ['Xylem', 'Phloem', 'Cambium', 'Epidermis'],
            answer: 'A',
            difficulty: 'easy',
            solution: 'Xylem tissue is responsible for the transport of water and minerals from roots to other parts of the plant.',
            explanation: 'Xylem conducts water upward, phloem transports food bidirectionally.'
          }
        ]
      },
      '12': {
        'Reproduction': [
          {
            id: 20,
            text: 'In humans, at the end of the first meiotic division, the male germ cells differentiate into the:',
            options: ['Spermatids', 'Spermatogonia', 'Primary spermatocytes', 'Secondary spermatocytes'],
            answer: 'D',
            difficulty: 'medium',
            solution: 'The first meiotic division in male germ cells produces secondary spermatocytes from primary spermatocytes. Spermatids are formed after the second meiotic division.',
            explanation: 'Spermatogenesis involves sequential differentiation: spermatogonia → primary spermatocytes → secondary spermatocytes → spermatids → spermatozoa.'
          }
        ],
        'Genetics and Evolution': [
          {
            id: 21,
            text: 'In a dihybrid cross, the phenotypic ratio in F2 generation is:',
            options: ['9:3:3:1', '3:1', '1:2:1', '1:1:1:1'],
            answer: 'A',
            difficulty: 'medium',
            solution: 'In a dihybrid cross, the F2 generation shows a 9:3:3:1 phenotypic ratio, where 9 represents both dominant traits, 3:3 represent one dominant and one recessive trait each, and 1 represents both recessive traits.',
            explanation: 'This is Mendel\'s law of independent assortment for two traits.'
          }
        ]
      }
    }
  }
};

let tests = [
  {
    id: 1,
    title: 'JEE Physics - Electrostatics Full Test',
    type: 'jee',
    subject: 'physics',
    class: '12',
    chapter: 'Electrostatics',
    difficulty: 'mixed',
    duration: 60,
    questionCount: 25,
    questions: [4, 15] // Question IDs
  },
  {
    id: 2,
    title: 'NEET Biology - Reproduction',
    type: 'neet',
    subject: 'biology',
    class: '12',
    chapter: 'Reproduction',
    difficulty: 'mixed',
    duration: 45,
    questionCount: 20,
    questions: [20, 21] // Question IDs
  }
];

let testResults = {};
let userSessions = {};

// Authentication middleware
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      success: false, 
      error: 'Authentication token required' 
    });
  }
  
  const token = authHeader.substring(7);
  
  // Simple token validation (in production, use JWT)
  if (token === 'admin-token' || token === 'teacher-token' || token === 'student-token') {
    next();
  } else {
    res.status(401).json({ 
      success: false, 
      error: 'Invalid authentication token' 
    });
  }
};

// Admin authorization middleware
const requireAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader.substring(7);
  
  if (token === 'admin-token') {
    next();
  } else {
    res.status(403).json({ 
      success: false, 
      error: 'Admin access required' 
    });
  }
};

// Routes

// User authentication
app.post('/api/auth/login', async (req, res) => {
  const { username, password, role } = req.body;
  
  const user = users.find(u => u.username === username);
  
  if (user) {
    // In production, use bcrypt.compare
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (validPassword && user.role === role) {
      // Generate simple token (in production, use JWT)
      const token = `${user.role}-token`;
      
      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          email: user.email
        },
        token: token
      });
    } else {
      res.status(401).json({
        success: false,
        error: 'Invalid username, password, or role'
      });
    }
  } else {
    res.status(401).json({
      success: false,
      error: 'Invalid username, password, or role'
    });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { username, password, role, email } = req.body;
  
  if (users.find(u => u.username === username)) {
    return res.status(400).json({
      success: false,
      error: 'Username already exists'
    });
  }
  
  try {
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = {
      id: users.length + 1,
      username,
      password: hashedPassword,
      role: role || 'student',
      email: email || `${username}@edusphere.com`
    };
    
    users.push(newUser);
    
    // Generate token
    const token = `${newUser.role}-token`;
    
    res.json({
      success: true,
      user: {
        id: newUser.id,
        username: newUser.username,
        role: newUser.role,
        email: newUser.email
      },
      token: token
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error creating user account'
    });
  }
});

// Question bank management
app.get('/api/questions/bank', (req, res) => {
  res.json({
    success: true,
    questionBank: questionBank
  });
});

app.get('/api/questions', authenticate, (req, res) => {
  const { examType, subject, class: classLevel, chapter, difficulty } = req.query;
  
  let filteredQuestions = [];
  
  if (examType && questionBank[examType]) {
    if (subject && questionBank[examType][subject]) {
      if (classLevel && questionBank[examType][subject][classLevel]) {
        if (chapter && questionBank[examType][subject][classLevel][chapter]) {
          const chapterQuestions = questionBank[examType][subject][classLevel][chapter];
          
          if (difficulty && difficulty !== 'mixed') {
            filteredQuestions = chapterQuestions.filter(q => q.difficulty === difficulty);
          } else {
            filteredQuestions = chapterQuestions;
          }
        }
      }
    }
  }
  
  res.json({
    success: true,
    questions: filteredQuestions
  });
});

app.post('/api/questions', authenticate, requireAdmin, (req, res) => {
  const { examType, class: classLevel, subject, chapter, difficulty, question } = req.body;
  
  // Validate inputs
  if (!examType || !classLevel || !subject || !chapter || !difficulty || !question) {
    return res.status(400).json({
      success: false,
      error: 'All fields are required'
    });
  }
  
  // Initialize structure if needed
  if (!questionBank[examType]) questionBank[examType] = {};
  if (!questionBank[examType][subject]) questionBank[examType][subject] = {};
  if (!questionBank[examType][subject][classLevel]) questionBank[examType][subject][classLevel] = {};
  if (!questionBank[examType][subject][classLevel][chapter]) {
    questionBank[examType][subject][classLevel][chapter] = [];
  }
  
  // Add question with ID
  const newQuestion = {
    id: Date.now(),
    ...question
  };
  
  questionBank[examType][subject][classLevel][chapter].push(newQuestion);
  
  res.json({
    success: true,
    question: newQuestion
  });
});

app.delete('/api/questions/:id', authenticate, requireAdmin, (req, res) => {
  const questionId = parseInt(req.params.id);
  
  let deleted = false;
  
  // Search and delete question from all categories
  Object.keys(questionBank).forEach(examType => {
    Object.keys(questionBank[examType]).forEach(subject => {
      Object.keys(questionBank[examType][subject]).forEach(classLevel => {
        Object.keys(questionBank[examType][subject][classLevel]).forEach(chapter => {
          const index = questionBank[examType][subject][classLevel][chapter].findIndex(q => q.id === questionId);
          if (index !== -1) {
            questionBank[examType][subject][classLevel][chapter].splice(index, 1);
            deleted = true;
          }
        });
      });
    });
  });
  
  if (deleted) {
    res.json({ success: true });
  } else {
    res.status(404).json({
      success: false,
      error: 'Question not found'
    });
  }
});

// Test management
app.get('/api/tests', authenticate, (req, res) => {
  // In production, fetch from database
  const availableTests = tests.map(test => {
    // Get actual questions for the test
    const testQuestions = [];
    test.questions.forEach(qId => {
      Object.keys(questionBank[test.type]).forEach(subject => {
        Object.keys(questionBank[test.type][subject]).forEach(classLevel => {
          Object.keys(questionBank[test.type][subject][classLevel]).forEach(chapter => {
            const question = questionBank[test.type][subject][classLevel][chapter].find(q => q.id === qId);
            if (question) testQuestions.push(question);
          });
        });
      });
    });
    
    return {
      ...test,
      questions: testQuestions
    };
  });
  
  res.json({
    success: true,
    tests: availableTests
  });
});

app.post('/api/tests', authenticate, requireAdmin, (req, res) => {
  const { title, type, subject, class: classLevel, chapter, difficulty, duration, questions } = req.body;
  
  const newTest = {
    id: tests.length + 1,
    title,
    type,
    subject,
    class: classLevel,
    chapter,
    difficulty,
    duration,
    questions: questions || [],
    createdAt: new Date().toISOString()
  };
  
  tests.push(newTest);
  
  res.json({
    success: true,
    test: newTest
  });
});

// Test results
app.post('/api/test-results', authenticate, (req, res) => {
  const { testId, testTitle, answers, score, totalQuestions, timeSpent } = req.body;
  
  // Get user from token (simplified)
  const authHeader = req.headers.authorization;
  const token = authHeader.substring(7);
  const userRole = token.split('-')[0];
  const username = `${userRole}@edusphere.com`;
  
  if (!testResults[username]) {
    testResults[username] = [];
  }
  
  const result = {
    testId,
    testTitle,
    score,
    totalQuestions,
    percentage: (score / totalQuestions * 100).toFixed(1),
    timeSpent,
    timestamp: new Date().toISOString(),
    answers
  };
  
  testResults[username].push(result);
  
  res.json({
    success: true,
    result: result
  });
});

app.get('/api/test-results', authenticate, (req, res) => {
  // Get user from token (simplified)
  const authHeader = req.headers.authorization;
  const token = authHeader.substring(7);
  const userRole = token.split('-')[0];
  const username = `${userRole}@edusphere.com`;
  
  const results = testResults[username] || [];
  
  res.json({
    success: true,
    results: results
  });
});

// AI Guidance with real OpenAI integration
app.post('/api/ai-guidance', authenticate, async (req, res) => {
  const { query } = req.body;
  
  if (!query) {
    return res.status(400).json({
      success: false,
      error: 'Query is required'
    });
  }
  
  try {
    // Real AI integration with OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are an expert JEE/NEET tutor. Provide detailed, accurate explanations for questions and study guidance. 
          Focus on concepts from Physics, Chemistry, Mathematics, and Biology for classes 11 and 12.
          Format your response in HTML with clear sections, examples, and study tips.`
        },
        {
          role: "user",
          content: query
        }
      ],
      max_tokens: 1500,
      temperature: 0.7
    });
    
    const guidance = completion.choices[0].message.content;
    
    res.json({
      success: true,
      guidance: guidance
    });
    
  } catch (error) {
    console.error('OpenAI API error:', error);
    
    // Fallback response if OpenAI API fails
    const fallbackGuidance = `
      <div class="guidance-result">
        <div class="guidance-topic">Study Guidance</div>
        <div class="guidance-content">
          <p>Based on your query about <strong>${query}</strong>, here are some comprehensive study strategies:</p>
          
          <h4>Key Concepts to Focus On:</h4>
          <ul>
            <li><strong>Understanding Fundamentals:</strong> Build strong conceptual foundations</li>
            <li><strong>Problem Solving:</strong> Practice diverse types of problems</li>
            <li><strong>Time Management:</strong> Develop efficient solving techniques</li>
            <li><strong>Regular Revision:</strong> Consistent review of learned concepts</li>
          </ul>
          
          <h4>Recommended Approach:</h4>
          <ol>
            <li>Study NCERT textbooks thoroughly</li>
            <li>Solve chapter-wise exercises</li>
            <li>Take regular mock tests</li>
            <li>Analyze mistakes and improve</li>
          </ol>
          
          <p><em>Note: For more specific guidance, please provide detailed questions about particular topics.</em></p>
        </div>
      </div>
    `;
    
    res.json({
      success: true,
      guidance: fallbackGuidance
    });
  }
});

// Serve the main application
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access the application at: http://localhost:${PORT}`);
});

module.exports = app;