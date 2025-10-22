require('dotenv').config();
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { OpenAI } = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const mongoose = require('mongoose');

const app = express();

// Find available port
const findAvailablePort = (startPort) => {
  return new Promise((resolve) => {
    const net = require('net');
    const server = net.createServer();
    
    server.listen(startPort, () => {
      server.close(() => {
        resolve(startPort);
      });
    });
    
    server.on('error', () => {
      resolve(findAvailablePort(startPort + 1));
    });
  });
};

// Initialize server with dynamic port
const initializeServer = async () => {
  const PORT = await findAvailablePort(3000);
  
  // MongoDB Connection
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://sarvesh:sarvesh9925@cluster0.kdzhsuc.mongodb.net/?retryWrites=true&w=majority';
  
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }

  // MongoDB Schemas and Models
  const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['student', 'teacher', 'admin'], default: 'student' },
    email: { type: String, required: true, unique: true },
    createdAt: { type: Date, default: Date.now }
  });

  userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
  });

  userSchema.methods.comparePassword = async function(password) {
    return await bcrypt.compare(password, this.password);
  };

  const questionSchema = new mongoose.Schema({
    examType: { type: String, enum: ['jee', 'neet'], required: true },
    subject: { type: String, required: true },
    class: { type: String, required: true },
    chapter: { type: String, required: true },
    text: { type: String, required: true },
    options: [{ type: String, required: true }],
    answer: { type: String, required: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true },
    solution: { type: String, required: true },
    explanation: { type: String },
    createdAt: { type: Date, default: Date.now }
  });

  const testSchema = new mongoose.Schema({
    title: { type: String, required: true },
    type: { type: String, enum: ['jee', 'neet'], required: true },
    subject: { type: String, required: true },
    class: { type: String, required: true },
    chapter: { type: String, required: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard', 'mixed'], default: 'mixed' },
    duration: { type: Number, required: true },
    questionCount: { type: Number, required: true },
    questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
  });

  const testResultSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    testId: { type: mongoose.Schema.Types.ObjectId, ref: 'Test' },
    testTitle: { type: String, required: true },
    answers: { type: Map, of: String },
    score: { type: Number, required: true },
    totalQuestions: { type: Number, required: true },
    percentage: { type: Number, required: true },
    timeSpent: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now }
  });

  const User = mongoose.model('User', userSchema);
  const Question = mongoose.model('Question', questionSchema);
  const Test = mongoose.model('Test', testSchema);
  const TestResult = mongoose.model('TestResult', testResultSchema);

  // Initialize AI Providers with Claude as primary
  let aiProvider = null;

  // Try Claude first
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      aiProvider = { 
        type: 'claude', 
        client: new Anthropic({ 
          apiKey: process.env.ANTHROPIC_API_KEY 
        }) 
      };
      console.log('Claude AI initialized successfully');
    } catch (error) {
      console.error('Error initializing Claude:', error);
    }
  }

  // Fallback to OpenAI if Claude fails
  if (!aiProvider && process.env.OPENAI_API_KEY) {
    try {
      aiProvider = { 
        type: 'openai', 
        client: new OpenAI({ 
          apiKey: process.env.OPENAI_API_KEY 
        }) 
      };
      console.log('OpenAI initialized as fallback');
    } catch (error) {
      console.error('Error initializing OpenAI:', error);
    }
  }

  // No AI providers available
  if (!aiProvider) {
    console.log('No AI API keys found - using fallback mode only');
  }

  // Middleware
  app.use(cors());
  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(express.static(path.join(__dirname, 'public')));

  // Initialize default data
  async function initializeDefaultData() {
    try {
      // Check if default users exist
      const adminExists = await User.findOne({ username: 'admin' });
      if (!adminExists) {
        const defaultUsers = [
          {
            username: 'admin',
            password: 'admin123',
            role: 'admin',
            email: 'admin@edusphere.com'
          },
          {
            username: 'teacher',
            password: 'teacher123',
            role: 'teacher',
            email: 'teacher@edusphere.com'
          },
          {
            username: 'student',
            password: 'student123',
            role: 'student',
            email: 'student@edusphere.com'
          }
        ];

        for (const userData of defaultUsers) {
          const user = new User(userData);
          await user.save();
        }
        console.log('Default users created');
      }

      // Check if default questions exist
      const questionCount = await Question.countDocuments();
      if (questionCount === 0) {
        const defaultQuestions = [
          {
            examType: 'jee',
            subject: 'physics',
            class: '11',
            chapter: 'Physical World and Measurement',
            text: 'Which of the following is not a fundamental unit?',
            options: ['meter', 'second', 'kilogram', 'newton'],
            answer: 'D',
            difficulty: 'easy',
            solution: 'Newton is a derived unit, not a fundamental unit. The fundamental units in SI system are meter, second, kilogram, ampere, kelvin, mole, and candela.',
            explanation: 'Fundamental units are independent and cannot be derived from other units, while derived units are combinations of fundamental units.'
          },
          {
            examType: 'jee',
            subject: 'physics',
            class: '11',
            chapter: 'Kinematics',
            text: 'A particle moves along a straight line with velocity v = 3t² - 6t m/s. The acceleration at t=2s is:',
            options: ['0 m/s²', '6 m/s²', '12 m/s²', '18 m/s²'],
            answer: 'B',
            difficulty: 'medium',
            solution: 'Acceleration a = dv/dt = 6t - 6. At t=2s, a = 6(2) - 6 = 12 - 6 = 6 m/s²',
            explanation: 'Differentiate the velocity function with respect to time to find acceleration.'
          },
          {
            examType: 'jee',
            subject: 'physics',
            class: '11',
            chapter: 'Laws of Motion',
            text: 'A body of mass 5 kg is acted upon by two perpendicular forces 8 N and 6 N. The magnitude of acceleration of the body is:',
            options: ['1 m/s²', '2 m/s²', '3 m/s²', '4 m/s²'],
            answer: 'B',
            difficulty: 'medium',
            solution: 'Resultant force F = √(8² + 6²) = √(64 + 36) = √100 = 10 N. Acceleration a = F/m = 10/5 = 2 m/s²',
            explanation: 'Find the resultant force using vector addition, then apply Newton\'s second law.'
          }
        ];

        await Question.insertMany(defaultQuestions);
        console.log('Default questions created');
      }
    } catch (error) {
      console.error('Error initializing default data:', error);
    }
  }

  // Authentication middleware
  const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication token required' 
      });
    }
    
    const token = authHeader.substring(7);
    
    try {
      const user = await User.findOne({ 
        $or: [
          { username: token.replace('-token', '') },
          { email: token.replace('-token', '') + '@edusphere.com' }
        ]
      });
      
      if (user) {
        req.user = user;
        next();
      } else {
        res.status(401).json({ 
          success: false, 
          error: 'Invalid authentication token' 
        });
      }
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: 'Authentication error' 
      });
    }
  };

  // Admin authorization middleware
  const requireAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
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
    
    try {
      const user = await User.findOne({ username });
      
      if (user) {
        const validPassword = await user.comparePassword(password);
        
        if (validPassword && user.role === role) {
          const token = `${user.role}-token`;
          
          res.json({
            success: true,
            user: {
              id: user._id,
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
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error during login'
      });
    }
  });

  app.post('/api/auth/register', async (req, res) => {
    const { username, password, role, email } = req.body;
    
    try {
      if (await User.findOne({ username })) {
        return res.status(400).json({
          success: false,
          error: 'Username already exists'
        });
      }
      
      if (await User.findOne({ email })) {
        return res.status(400).json({
          success: false,
          error: 'Email already exists'
        });
      }
      
      const newUser = new User({
        username,
        password,
        role: role || 'student',
        email: email || `${username}@edusphere.com`
      });
      
      await newUser.save();
      
      const token = `${newUser.role}-token`;
      
      res.json({
        success: true,
        user: {
          id: newUser._id,
          username: newUser.username,
          role: newUser.role,
          email: newUser.email
        },
        token: token
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        error: 'Error creating user account'
      });
    }
  });

  // Question bank management
  app.get('/api/questions/bank', async (req, res) => {
    try {
      const questions = await Question.find();
      
      const questionBank = {
        jee: { physics: {}, chemistry: {}, mathematics: {} },
        neet: { physics: {}, chemistry: {}, biology: {} }
      };
      
      questions.forEach(question => {
        if (!questionBank[question.examType]) return;
        if (!questionBank[question.examType][question.subject]) return;
        
        if (!questionBank[question.examType][question.subject][question.class]) {
          questionBank[question.examType][question.subject][question.class] = {};
        }
        
        if (!questionBank[question.examType][question.subject][question.class][question.chapter]) {
          questionBank[question.examType][question.subject][question.class][question.chapter] = [];
        }
        
        questionBank[question.examType][question.subject][question.class][question.chapter].push({
          id: question._id,
          text: question.text,
          options: question.options,
          answer: question.answer,
          difficulty: question.difficulty,
          solution: question.solution,
          explanation: question.explanation
        });
      });
      
      res.json({
        success: true,
        questionBank: questionBank
      });
    } catch (error) {
      console.error('Error fetching question bank:', error);
      res.status(500).json({
        success: false,
        error: 'Error fetching question bank'
      });
    }
  });

  app.get('/api/questions', authenticate, async (req, res) => {
    const { examType, subject, class: classLevel, chapter, difficulty } = req.query;
    
    try {
      const query = {};
      if (examType) query.examType = examType;
      if (subject) query.subject = subject;
      if (classLevel) query.class = classLevel;
      if (chapter) query.chapter = chapter;
      if (difficulty && difficulty !== 'mixed') query.difficulty = difficulty;
      
      const questions = await Question.find(query);
      
      res.json({
        success: true,
        questions: questions.map(q => ({
          id: q._id,
          text: q.text,
          options: q.options,
          answer: q.answer,
          difficulty: q.difficulty,
          solution: q.solution,
          explanation: q.explanation
        }))
      });
    } catch (error) {
      console.error('Error fetching questions:', error);
      res.status(500).json({
        success: false,
        error: 'Error fetching questions'
      });
    }
  });

  app.post('/api/questions', authenticate, requireAdmin, async (req, res) => {
    const { examType, class: classLevel, subject, chapter, difficulty, question } = req.body;
    
    if (!examType || !classLevel || !subject || !chapter || !difficulty || !question) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required'
      });
    }
    
    try {
      const newQuestion = new Question({
        examType,
        class: classLevel,
        subject,
        chapter,
        difficulty,
        ...question
      });
      
      await newQuestion.save();
      
      res.json({
        success: true,
        question: {
          id: newQuestion._id,
          ...question
        }
      });
    } catch (error) {
      console.error('Error creating question:', error);
      res.status(500).json({
        success: false,
        error: 'Error creating question'
      });
    }
  });

  app.delete('/api/questions/:id', authenticate, requireAdmin, async (req, res) => {
    const questionId = req.params.id;
    
    try {
      const result = await Question.findByIdAndDelete(questionId);
      
      if (result) {
        res.json({ success: true });
      } else {
        res.status(404).json({
          success: false,
          error: 'Question not found'
        });
      }
    } catch (error) {
      console.error('Error deleting question:', error);
      res.status(500).json({
        success: false,
        error: 'Error deleting question'
      });
    }
  });

  // Test management
  app.get('/api/tests', authenticate, async (req, res) => {
    try {
      const tests = await Test.find().populate('questions');
      
      const availableTests = tests.map(test => ({
        id: test._id,
        title: test.title,
        type: test.type,
        subject: test.subject,
        class: test.class,
        chapter: test.chapter,
        difficulty: test.difficulty,
        duration: test.duration,
        questionCount: test.questionCount,
        questions: test.questions.map(q => ({
          id: q._id,
          text: q.text,
          options: q.options,
          answer: q.answer,
          difficulty: q.difficulty,
          solution: q.solution,
          explanation: q.explanation
        }))
      }));
      
      res.json({
        success: true,
        tests: availableTests
      });
    } catch (error) {
      console.error('Error fetching tests:', error);
      res.status(500).json({
        success: false,
        error: 'Error fetching tests'
      });
    }
  });

  app.post('/api/tests', authenticate, requireAdmin, async (req, res) => {
    const { title, type, subject, class: classLevel, chapter, difficulty, duration, questions } = req.body;
    
    try {
      const newTest = new Test({
        title,
        type,
        subject,
        class: classLevel,
        chapter,
        difficulty: difficulty || 'mixed',
        duration,
        questionCount: questions ? questions.length : 0,
        questions: questions || [],
        createdBy: req.user._id
      });
      
      await newTest.save();
      
      res.json({
        success: true,
        test: {
          id: newTest._id,
          title: newTest.title,
          type: newTest.type,
          subject: newTest.subject,
          class: newTest.class,
          chapter: newTest.chapter,
          difficulty: newTest.difficulty,
          duration: newTest.duration,
          questionCount: newTest.questionCount,
          questions: newTest.questions
        }
      });
    } catch (error) {
      console.error('Error creating test:', error);
      res.status(500).json({
        success: false,
        error: 'Error creating test'
      });
    }
  });

  // Test results
  app.post('/api/test-results', authenticate, async (req, res) => {
    const { testId, testTitle, answers, score, totalQuestions, timeSpent } = req.body;
    
    try {
      const result = new TestResult({
        userId: req.user._id,
        testId: testId,
        testTitle,
        answers,
        score,
        totalQuestions,
        percentage: (score / totalQuestions * 100),
        timeSpent,
        timestamp: new Date()
      });
      
      await result.save();
      
      res.json({
        success: true,
        result: {
          testId: result.testId,
          testTitle: result.testTitle,
          score: result.score,
          totalQuestions: result.totalQuestions,
          percentage: result.percentage,
          timeSpent: result.timeSpent,
          timestamp: result.timestamp,
          answers: result.answers
        }
      });
    } catch (error) {
      console.error('Error saving test result:', error);
      res.status(500).json({
        success: false,
        error: 'Error saving test result'
      });
    }
  });

  app.get('/api/test-results', authenticate, async (req, res) => {
    try {
      const results = await TestResult.find({ userId: req.user._id }).sort({ timestamp: -1 });
      
      res.json({
        success: true,
        results: results.map(result => ({
          testId: result.testId,
          testTitle: result.testTitle,
          score: result.score,
          totalQuestions: result.totalQuestions,
          percentage: result.percentage,
          timeSpent: result.timeSpent,
          timestamp: result.timestamp,
          answers: result.answers
        }))
      });
    } catch (error) {
      console.error('Error fetching test results:', error);
      res.status(500).json({
        success: false,
        error: 'Error fetching test results'
      });
    }
  });

  // AI Guidance with Claude as primary, OpenAI as fallback
 // AI Guidance with better error handling and fallback
app.post('/api/ai-guidance', authenticate, async (req, res) => {
  const { query } = req.body;
  
  if (!query) {
    return res.status(400).json({
      success: false,
      error: 'Query is required'
    });
  }
  
  try {
    let guidance;
    let provider = 'fallback';
    
    // Try Claude first
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY
        });
        
        const message = await anthropic.messages.create({
          model: "claude-3-haiku-20240307",
          max_tokens: 1500,
          temperature: 0.7,
          system: `You are an expert JEE/NEET tutor. Provide detailed explanations, study strategies, and step-by-step solutions. Format response in HTML with clear sections. Be comprehensive and practical.`,
          messages: [{
            role: "user",
            content: `JEE/NEET preparation question: ${query}`
          }]
        });
        
        guidance = message.content[0].text;
        provider = 'claude';
        
      } catch (claudeError) {
        console.log('Claude failed, trying OpenAI...');
      }
    }
    
    // Try OpenAI if Claude fails or not configured
    if (!guidance && process.env.OPENAI_API_KEY) {
      try {
        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY
        });
        
        const completion = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [{
            role: "system",
            content: "You are an expert JEE/NEET tutor. Provide detailed explanations and study guidance."
          }, {
            role: "user",
            content: query
          }],
          max_tokens: 1500,
          temperature: 0.7
        });
        
        guidance = completion.choices[0].message.content;
        provider = 'openai';
        
      } catch (openaiError) {
        console.log('OpenAI failed, using fallback...');
      }
    }
    
    // Use fallback if AI services fail
    if (!guidance) {
      guidance = generateEnhancedFallbackGuidance(query);
    }
    
    res.json({
      success: true,
      guidance: guidance,
      provider: provider
    });
    
  } catch (error) {
    console.error('AI guidance error:', error);
    const fallbackGuidance = generateEnhancedFallbackGuidance(query);
    
    res.json({
      success: true,
      guidance: fallbackGuidance,
      provider: 'fallback'
    });
  }
});

// Enhanced fallback guidance
function generateEnhancedFallbackGuidance(query) {
  return `
    <div class="guidance-result">
      <div class="guidance-header">
        <i class="fas fa-robot"></i>
        <h3>AI Study Guidance</h3>
      </div>
      <div class="guidance-content">
        <div class="query-preview">
          <strong>Your Query:</strong> "${query}"
        </div>
        
        <div class="study-plan">
          <h4>📚 Personalized Study Plan</h4>
          <div class="plan-grid">
            <div class="plan-item">
              <div class="plan-icon">⏰</div>
              <div class="plan-text">
                <strong>Daily Schedule</strong>
                <p>6-8 hours focused study with breaks</p>
              </div>
            </div>
            <div class="plan-item">
              <div class="plan-icon">📖</div>
              <div class="plan-text">
                <strong>NCERT Focus</strong>
                <p>Master concepts from NCERT textbooks</p>
              </div>
            </div>
            <div class="plan-item">
              <div class="plan-icon">✍️</div>
              <div class="plan-text">
                <strong>Practice</strong>
                <p>50+ problems daily with revision</p>
              </div>
            </div>
          </div>
        </div>
        
        <div class="quick-tips">
          <h4>🚀 Quick Preparation Tips</h4>
          <ul>
            <li>Solve previous 10 years' question papers</li>
            <li>Focus on weak areas identified through mock tests</li>
            <li>Create formula sheets for quick revision</li>
            <li>Join study groups for doubt clearance</li>
          </ul>
        </div>
        
        <div class="ai-note">
          <i class="fas fa-info-circle"></i>
          <p>For more detailed AI-powered explanations, add your API keys to environment variables.</p>
        </div>
      </div>
    </div>
  `;
}

  // Serve the main application
  app.get('/', (req, res) => {
    res.json({ 
      success: true,
      message: 'EduSphere API Server is running successfully!',
      version: '1.0.0',
      endpoints: {
        auth: ['/api/auth/login', '/api/auth/register'],
        questions: ['/api/questions', '/api/questions/bank'],
        tests: ['/api/tests'],
        results: ['/api/test-results'],
        ai: ['/api/ai-guidance']
      },
      documentation: 'Use the API endpoints with proper authentication'
    });
  });

  // Start server
  app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Access the application at: http://localhost:${PORT}`);
    
    // Initialize default data
    await initializeDefaultData();
  });
};

// Initialize the server
initializeServer().catch(console.error);

module.exports = app;