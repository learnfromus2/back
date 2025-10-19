const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/edusphere';

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('✅ Connected to MongoDB');
}).catch(err => {
    console.error('❌ MongoDB connection error:', err);
});

// Enhanced Schemas
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['student', 'teacher', 'admin'], default: 'student' },
    profile: {
        name: String,
        targetExam: { type: String, enum: ['JEE Main', 'JEE Advanced', 'NEET'], default: 'JEE Main' },
        class: String,
        school: String
    },
    performanceStats: {
        testsAttempted: { type: Number, default: 0 },
        averageScore: { type: Number, default: 0 },
        rank: Number,
        accuracy: Number
    },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

const questionSchema = new mongoose.Schema({
    question: { type: String, required: true },
    options: [{ type: String, required: true }],
    correctAnswer: { type: Number, required: true },
    explanation: String,
    solution: String,
    subject: { type: String, required: true },
    chapter: { type: String, required: true },
    topic: String,
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true },
    marks: { type: Number, default: 4 },
    exam: { type: String, enum: ['JEE Main', 'JEE Advanced', 'NEET'], default: 'JEE Main' },
    year: Number,
    source: String,
    createdBy: String,
    createdAt: { type: Date, default: Date.now }
});

const Question = mongoose.model('Question', questionSchema);

const testSchema = new mongoose.Schema({
    title: String,
    description: String,
    type: { type: String, enum: ['chapter', 'subject', 'full', 'custom'], default: 'chapter' },
    questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
    duration: Number,
    subject: String,
    chapter: String,
    maxMarks: Number,
    instructions: [String],
    isPublic: { type: Boolean, default: true },
    createdBy: String,
    createdAt: { type: Date, default: Date.now }
});

const Test = mongoose.model('Test', testSchema);

const performanceSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    testId: { type: mongoose.Schema.Types.ObjectId, ref: 'Test' },
    score: Number,
    maxMarks: Number,
    percentage: Number,
    timeTaken: Number,
    rank: Number,
    answers: [{
        questionId: mongoose.Schema.Types.ObjectId,
        selectedAnswer: Number,
        isCorrect: Boolean,
        timeSpent: Number
    }],
    subjectWise: [{
        subject: String,
        correct: Number,
        total: Number,
        percentage: Number
    }],
    chapterWise: [{
        chapter: String,
        correct: Number,
        total: Number,
        percentage: Number
    }],
    createdAt: { type: Date, default: Date.now }
});

const Performance = mongoose.model('Performance', performanceSchema);

const studyMaterialSchema = new mongoose.Schema({
    title: String,
    type: { type: String, enum: ['pdf', 'video', 'notes', 'formula'], default: 'notes' },
    subject: String,
    chapter: String,
    topic: String,
    url: String,
    description: String,
    createdBy: String,
    createdAt: { type: Date, default: Date.now }
});

const StudyMaterial = mongoose.model('StudyMaterial', studyMaterialSchema);

// CORS configuration
const allowedOrigins = [
    'https://front1-jlg7.onrender.com',
    'http://localhost:3000',
    'http://localhost:8080',
    'https://eduspherebackend-0ytt.onrender.com'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

app.options('*', cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'edusphere-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        httpOnly: true
    },
    store: MongoStore.create({
        mongoUrl: MONGODB_URI,
        collectionName: 'sessions'
    })
}));

// Authentication Middleware
const requireAuth = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.status(401).json({ error: 'Authentication required' });
    }
};

const requireAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Admin access required' });
    }
};

// API Routes

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
    });
});

// Auth routes
app.post('/api/register', async (req, res) => {
    try {
        const { username, password, role, profile } = req.body;
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const user = new User({
            username,
            password: hashedPassword,
            role: role || 'student',
            profile: profile || {}
        });
        
        await user.save();
        res.json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(400).json({ error: 'Registration failed - username may already exist' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const user = await User.findOne({ username });
        
        if (user && await bcrypt.compare(password, user.password)) {
            req.session.user = {
                id: user._id,
                username: user.username,
                role: user.role,
                profile: user.profile
            };
            res.json({ message: 'Login successful', user: req.session.user });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Logout successful' });
});

app.get('/api/user', (req, res) => {
    res.json({ user: req.session.user || null });
});

// Enhanced Questions with filtering
app.get('/api/questions', requireAuth, async (req, res) => {
    try {
        const { subject, chapter, difficulty, exam, page = 1, limit = 20 } = req.query;
        let filter = {};
        
        if (subject) filter.subject = subject;
        if (chapter) filter.chapter = chapter;
        if (difficulty) filter.difficulty = difficulty;
        if (exam) filter.exam = exam;

        const questions = await Question.find(filter)
            .limit(limit * 1)
            .skip((page - 1) * limit);
            
        const total = await Question.countDocuments(filter);
        
        res.json({
            questions,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        console.error('Questions fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch questions' });
    }
});

app.get('/api/questions/filters', requireAuth, async (req, res) => {
    try {
        const subjects = await Question.distinct('subject');
        const chapters = await Question.distinct('chapter');
        const exams = await Question.distinct('exam');
        const difficulties = ['easy', 'medium', 'hard'];
        
        res.json({ subjects, chapters, exams, difficulties });
    } catch (error) {
        console.error('Filters fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch filters' });
    }
});

app.post('/api/questions', requireAuth, async (req, res) => {
    try {
        const question = new Question({
            ...req.body,
            createdBy: req.session.user.username
        });
        await question.save();
        res.json(question);
    } catch (error) {
        console.error('Question creation error:', error);
        res.status(500).json({ error: 'Failed to create question' });
    }
});

// Enhanced Tests like tayyari.in
app.get('/api/tests', requireAuth, async (req, res) => {
    try {
        const { type, subject } = req.query;
        let filter = { isPublic: true };
        
        if (type) filter.type = type;
        if (subject) filter.subject = subject;

        const tests = await Test.find(filter).populate('questions');
        res.json(tests);
    } catch (error) {
        console.error('Tests fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch tests' });
    }
});

app.post('/api/tests', requireAuth, async (req, res) => {
    try {
        const test = new Test({
            ...req.body,
            createdBy: req.session.user.username
        });
        await test.save();
        res.json(test);
    } catch (error) {
        console.error('Test creation error:', error);
        res.status(500).json({ error: 'Failed to create test' });
    }
});

// Smart Test Generation like tayyari.in
app.post('/api/generate-test', requireAuth, async (req, res) => {
    try {
        const { subject, chapters, difficulty, questionCount = 25, exam = 'JEE Main' } = req.body;
        
        let filter = { exam };
        if (subject) filter.subject = subject;
        if (chapters && chapters.length > 0) filter.chapter = { $in: chapters };
        if (difficulty && difficulty !== 'all') filter.difficulty = difficulty;
        
        const availableQuestions = await Question.find(filter);
        
        if (availableQuestions.length < questionCount) {
            return res.status(400).json({ 
                error: `Not enough questions available. Found ${availableQuestions.length}, requested ${questionCount}` 
            });
        }
        
        // Smart selection: mix of difficulties if not specified
        let selectedQuestions = [];
        if (difficulty && difficulty !== 'all') {
            selectedQuestions = availableQuestions.sort(() => 0.5 - Math.random()).slice(0, questionCount);
        } else {
            // Mix: 40% easy, 40% medium, 20% hard
            const easy = availableQuestions.filter(q => q.difficulty === 'easy');
            const medium = availableQuestions.filter(q => q.difficulty === 'medium');
            const hard = availableQuestions.filter(q => q.difficulty === 'hard');
            
            const easyCount = Math.min(Math.floor(questionCount * 0.4), easy.length);
            const mediumCount = Math.min(Math.floor(questionCount * 0.4), medium.length);
            const hardCount = questionCount - easyCount - mediumCount;
            
            selectedQuestions = [
                ...easy.sort(() => 0.5 - Math.random()).slice(0, easyCount),
                ...medium.sort(() => 0.5 - Math.random()).slice(0, mediumCount),
                ...hard.sort(() => 0.5 - Math.random()).slice(0, hardCount)
            ].sort(() => 0.5 - Math.random());
        }
        
        const testTitle = subject ? 
            `${subject} ${chapters ? chapters.join(', ') : ''} Test` : 
            'Custom Practice Test';
            
        const test = new Test({
            title: testTitle,
            description: `Custom test for ${exam} preparation`,
            type: 'custom',
            questions: selectedQuestions.map(q => q._id),
            duration: questionCount * 1.2, // 1.2 minutes per question
            subject: subject || 'Mixed',
            maxMarks: selectedQuestions.reduce((sum, q) => sum + q.marks, 0),
            instructions: [
                "All questions are compulsory",
                "Each question carries marks as indicated",
                "No negative marking for this test",
                "Use rough sheets for calculations"
            ],
            isPublic: false,
            createdBy: req.session.user.username
        });
        
        await test.save();
        await test.populate('questions');
        
        res.json(test);
    } catch (error) {
        console.error('Test generation error:', error);
        res.status(500).json({ error: 'Failed to generate test' });
    }
});

// Take Test
app.post('/api/tests/:testId/start', requireAuth, async (req, res) => {
    try {
        const test = await Test.findById(req.params.testId).populate('questions');
        if (!test) {
            return res.status(404).json({ error: 'Test not found' });
        }
        
        // Return test without answers for security
        const testForStudent = {
            ...test.toObject(),
            questions: test.questions.map(q => ({
                _id: q._id,
                question: q.question,
                options: q.options,
                marks: q.marks,
                subject: q.subject,
                chapter: q.chapter,
                difficulty: q.difficulty
            }))
        };
        
        res.json(testForStudent);
    } catch (error) {
        console.error('Test start error:', error);
        res.status(500).json({ error: 'Failed to start test' });
    }
});

// Submit Test
app.post('/api/tests/:testId/submit', requireAuth, async (req, res) => {
    try {
        const { answers, timeTaken } = req.body;
        const test = await Test.findById(req.params.testId).populate('questions');
        
        if (!test) {
            return res.status(404).json({ error: 'Test not found' });
        }
        
        let score = 0;
        let totalMarks = 0;
        const detailedAnswers = [];
        const subjectWise = {};
        const chapterWise = {};
        
        // Calculate score and analyze performance
        for (const question of test.questions) {
            totalMarks += question.marks;
            const userAnswer = answers.find(a => a.questionId === question._id.toString());
            const isCorrect = userAnswer && userAnswer.selectedAnswer === question.correctAnswer;
            
            if (isCorrect) {
                score += question.marks;
            }
            
            detailedAnswers.push({
                questionId: question._id,
                selectedAnswer: userAnswer ? userAnswer.selectedAnswer : -1,
                isCorrect,
                timeSpent: userAnswer ? userAnswer.timeSpent : 0
            });
            
            // Subject-wise analysis
            if (!subjectWise[question.subject]) {
                subjectWise[question.subject] = { correct: 0, total: 0 };
            }
            subjectWise[question.subject].total++;
            if (isCorrect) subjectWise[question.subject].correct++;
            
            // Chapter-wise analysis
            if (!chapterWise[question.chapter]) {
                chapterWise[question.chapter] = { correct: 0, total: 0 };
            }
            chapterWise[question.chapter].total++;
            if (isCorrect) chapterWise[question.chapter].correct++;
        }
        
        const percentage = (score / totalMarks) * 100;
        
        // Save performance
        const performance = new Performance({
            userId: req.session.user.id,
            testId: test._id,
            score,
            maxMarks: totalMarks,
            percentage,
            timeTaken,
            answers: detailedAnswers,
            subjectWise: Object.entries(subjectWise).map(([subject, data]) => ({
                subject,
                correct: data.correct,
                total: data.total,
                percentage: (data.correct / data.total) * 100
            })),
            chapterWise: Object.entries(chapterWise).map(([chapter, data]) => ({
                chapter,
                correct: data.correct,
                total: data.total,
                percentage: (data.correct / data.total) * 100
            }))
        });
        
        await performance.save();
        
        // Update user stats
        await User.findByIdAndUpdate(req.session.user.id, {
            $inc: { 'performanceStats.testsAttempted': 1 }
        });
        
        res.json({
            score,
            maxMarks: totalMarks,
            percentage: percentage.toFixed(2),
            subjectWise: performance.subjectWise,
            chapterWise: performance.chapterWise,
            answers: detailedAnswers.map(a => ({
                questionId: a.questionId,
                isCorrect: a.isCorrect,
                correctAnswer: test.questions.find(q => q._id.equals(a.questionId)).correctAnswer
            }))
        });
    } catch (error) {
        console.error('Test submit error:', error);
        res.status(500).json({ error: 'Failed to submit test' });
    }
});

// Performance Analytics
app.get('/api/performance', requireAuth, async (req, res) => {
    try {
        const performances = await Performance.find({ userId: req.session.user.id })
            .populate('testId')
            .sort({ createdAt: -1 });
        
        // Calculate overall stats
        const totalTests = performances.length;
        const averageScore = totalTests > 0 ? 
            performances.reduce((sum, p) => sum + p.percentage, 0) / totalTests : 0;
            
        res.json({
            performances,
            stats: {
                totalTests,
                averageScore: averageScore.toFixed(2),
                bestScore: totalTests > 0 ? Math.max(...performances.map(p => p.percentage)) : 0,
                totalQuestions: performances.reduce((sum, p) => sum + p.answers.length, 0),
                correctAnswers: performances.reduce((sum, p) => sum + p.answers.filter(a => a.isCorrect).length, 0)
            }
        });
    } catch (error) {
        console.error('Performance fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch performance' });
    }
});

// Enhanced AI Guidance with real analytics
app.get('/api/ai-guidance/:subject?/:chapter?', requireAuth, async (req, res) => {
    try {
        const { subject, chapter } = req.params;
        
        // Get user's performance data for personalized guidance
        const userPerformance = await Performance.find({ userId: req.session.user.id })
            .populate('testId');
        
        let guidance = {};
        
        if (subject && chapter) {
            // Chapter-specific guidance
            guidance = await generateChapterGuidance(subject, chapter, userPerformance);
        } else if (subject) {
            // Subject-specific guidance
            guidance = await generateSubjectGuidance(subject, userPerformance);
        } else {
            // Overall guidance
            guidance = await generateOverallGuidance(userPerformance);
        }
        
        res.json(guidance);
    } catch (error) {
        console.error('AI Guidance error:', error);
        res.status(500).json({ error: 'Failed to generate guidance' });
    }
});

// Study Materials
app.get('/api/study-materials', requireAuth, async (req, res) => {
    try {
        const { subject, chapter, type } = req.query;
        let filter = {};
        
        if (subject) filter.subject = subject;
        if (chapter) filter.chapter = chapter;
        if (type) filter.type = type;

        const materials = await StudyMaterial.find(filter);
        res.json(materials);
    } catch (error) {
        console.error('Study materials fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch study materials' });
    }
});

// Serve static files
app.use(express.static(__dirname));

// Serve index.html for all other routes
app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>EduSphere - JEE/NEET Preparation Platform</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; background: #f0f0f0; }
                    .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    h1 { color: #333; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🚀 EduSphere - JEE/NEET Preparation Platform</h1>
                    <p>Backend server is running. Use the frontend application to access all features.</p>
                </div>
            </body>
            </html>
        `);
    }
});

// Helper functions for AI Guidance
async function generateChapterGuidance(subject, chapter, userPerformance) {
    const chapterQuestions = await Question.find({ subject, chapter });
    const chapterPerformance = userPerformance.flatMap(p => 
        p.chapterWise.filter(c => c.chapter === chapter)
    );
    
    const difficultyCount = {
        easy: chapterQuestions.filter(q => q.difficulty === 'easy').length,
        medium: chapterQuestions.filter(q => q.difficulty === 'medium').length,
        hard: chapterQuestions.filter(q => q.difficulty === 'hard').length
    };
    
    const avgChapterScore = chapterPerformance.length > 0 ? 
        chapterPerformance.reduce((sum, p) => sum + p.percentage, 0) / chapterPerformance.length : 0;
    
    return {
        type: 'chapter',
        subject,
        chapter,
        statistics: {
            totalQuestions: chapterQuestions.length,
            difficultyBreakdown: difficultyCount,
            yourAverageScore: avgChapterScore.toFixed(2),
            recommendedFocus: avgChapterScore < 60 ? 'High' : avgChapterScore < 80 ? 'Medium' : 'Low'
        },
        studyPlan: generateChapterStudyPlan(chapter, difficultyCount, avgChapterScore),
        resources: await getChapterResources(subject, chapter),
        tips: getChapterTips(subject, chapter)
    };
}

function generateChapterStudyPlan(chapter, difficultyCount, avgScore) {
    const total = difficultyCount.easy + difficultyCount.medium + difficultyCount.hard;
    
    if (avgScore < 60) {
        return {
            focus: "Build Fundamental Understanding",
            dailyTarget: `${Math.ceil(total * 0.1)} questions daily`,
            priority: "Start with easy questions, then medium",
            timeline: "2-3 weeks for mastery",
            activities: [
                "Watch concept videos",
                "Solve easy questions first",
                "Practice derivations/formulas",
                "Take chapter-wise tests"
            ]
        };
    } else if (avgScore < 80) {
        return {
            focus: "Improve Speed and Accuracy",
            dailyTarget: `${Math.ceil(total * 0.15)} questions daily`,
            priority: "Mix of medium and hard questions",
            timeline: "1-2 weeks for excellence",
            activities: [
                "Time-bound practice",
                "Focus on tricky questions",
                "Revise formulas regularly",
                "Take timed chapter tests"
            ]
        };
    } else {
        return {
            focus: "Maintain Excellence",
            dailyTarget: `${Math.ceil(total * 0.05)} questions daily`,
            priority: "Hard questions and revisions",
            timeline: "Weekly revision",
            activities: [
                "Solve advanced problems",
                "Practice previous year questions",
                "Teach concepts to others",
                "Take full syllabus tests"
            ]
        };
    }
}

async function getChapterResources(subject, chapter) {
    const resources = await StudyMaterial.find({ subject, chapter });
    return resources.length > 0 ? resources : [
        {
            title: `${chapter} Study Notes`,
            type: 'notes',
            description: 'Comprehensive notes for quick revision'
        },
        {
            title: `${chapter} Formula Sheet`,
            type: 'formula',
            description: 'Important formulas and theorems'
        },
        {
            title: `${chapter} Practice Questions`,
            type: 'pdf',
            description: 'Chapter-wise practice problems'
        }
    ];
}

function getChapterTips(subject, chapter) {
    const tips = {
        Physics: {
            "Mechanics": [
                "Focus on free-body diagrams",
                "Practice numerical problems daily",
                "Understand Newton's laws thoroughly",
                "Master conservation laws"
            ],
            "Electricity and Magnetism": [
                "Understand circuit laws",
                "Practice Gauss's law applications",
                "Master right-hand rules",
                "Solve capacitor problems"
            ]
        },
        Chemistry: {
            "Organic Chemistry": [
                "Memorize reaction mechanisms",
                "Practice named reactions",
                "Understand stereochemistry",
                "Solve conversion problems"
            ],
            "Physical Chemistry": [
                "Practice numerical regularly",
                "Understand concepts deeply",
                "Master formulas and units",
                "Solve previous year questions"
            ]
        },
        Mathematics: {
            "Calculus": [
                "Practice differentiation",
                "Master integration techniques",
                "Understand applications",
                "Solve area/volume problems"
            ],
            "Algebra": [
                "Practice quadratic equations",
                "Master sequences and series",
                "Understand complex numbers",
                "Solve probability problems"
            ]
        }
    };
    
    return tips[subject]?.[chapter] || [
        "Practice regularly",
        "Understand concepts deeply",
        "Solve previous year questions",
        "Take regular mock tests"
    ];
}

async function generateSubjectGuidance(subject, userPerformance) {
    const subjectQuestions = await Question.find({ subject });
    const subjectPerformance = userPerformance.flatMap(p => 
        p.subjectWise.filter(s => s.subject === subject)
    );
    
    const chapters = await Question.distinct('chapter', { subject });
    const chapterPerformance = await Promise.all(
        chapters.map(async chapter => {
            const perf = userPerformance.flatMap(p => 
                p.chapterWise.filter(c => c.chapter === chapter)
            );
            const avgScore = perf.length > 0 ? 
                perf.reduce((sum, p) => sum + p.percentage, 0) / perf.length : 0;
            return { chapter, avgScore };
        })
    );
    
    const weakChapters = chapterPerformance.filter(c => c.avgScore < 60).map(c => c.chapter);
    const strongChapters = chapterPerformance.filter(c => c.avgScore >= 80).map(c => c.chapter);
    
    return {
        type: 'subject',
        subject,
        statistics: {
            totalQuestions: subjectQuestions.length,
            totalChapters: chapters.length,
            weakChapters,
            strongChapters,
            recommendedFocus: weakChapters.length > 2 ? 'High' : 'Medium'
        },
        studyPlan: generateSubjectStudyPlan(subject, weakChapters, strongChapters),
        priority: weakChapters.slice(0, 3),
        resources: await getSubjectResources(subject)
    };
}

function generateSubjectStudyPlan(subject, weakChapters, strongChapters) {
    return {
        focus: weakChapters.length > 0 ? "Improve Weak Areas" : "Enhance Strong Areas",
        weeklyTarget: `${weakChapters.length || 2} chapters per week`,
        dailySchedule: [
            "2 hours concept study",
            "1 hour problem solving",
            "30 minutes revision",
            "Weekly full test"
        ],
        strategy: weakChapters.length > 0 ? 
            `Focus on: ${weakChapters.slice(0, 3).join(', ')}` :
            `Master: ${strongChapters.slice(0, 3).join(', ')}`
    };
}

async function getSubjectResources(subject) {
    const resources = await StudyMaterial.find({ subject });
    return resources.length > 0 ? resources : [
        {
            title: `${subject} Complete Guide`,
            type: 'pdf',
            description: 'Comprehensive subject guide'
        },
        {
            title: `${subject} Formula Book`,
            type: 'formula',
            description: 'All important formulas'
        },
        {
            title: `${subject} Previous Year Papers`,
            type: 'pdf',
            description: '10 years of question papers'
        }
    ];
}

async function generateOverallGuidance(userPerformance) {
    const totalTests = userPerformance.length;
    const avgScore = totalTests > 0 ? 
        userPerformance.reduce((sum, p) => sum + p.percentage, 0) / totalTests : 0;
    
    const subjects = await Question.distinct('subject');
    const subjectPerformance = await Promise.all(
        subjects.map(async subject => {
            const perf = userPerformance.flatMap(p => 
                p.subjectWise.filter(s => s.subject === subject)
            );
            const avgScore = perf.length > 0 ? 
                perf.reduce((sum, p) => sum + p.percentage, 0) / perf.length : 0;
            return { subject, avgScore };
        })
    );
    
    const weakSubjects = subjectPerformance.filter(s => s.avgScore < 60).map(s => s.subject);
    const strongSubjects = subjectPerformance.filter(s => s.avgScore >= 70).map(s => s.subject);
    
    return {
        type: 'overall',
        statistics: {
            totalTests,
            averageScore: avgScore.toFixed(2),
            weakSubjects,
            strongSubjects,
            overallLevel: avgScore < 50 ? 'Beginner' : avgScore < 70 ? 'Intermediate' : 'Advanced'
        },
        studyPlan: generateOverallStudyPlan(avgScore, weakSubjects),
        recommendations: getOverallRecommendations(avgScore, weakSubjects),
        weeklyTarget: generateWeeklyTarget(weakSubjects.length)
    };
}

function generateOverallStudyPlan(avgScore, weakSubjects) {
    if (avgScore < 50) {
        return {
            focus: "Build Strong Foundation",
            dailyHours: "4-6 hours",
            priority: "Concept understanding",
            subjectsOrder: weakSubjects.length > 0 ? weakSubjects : ["Physics", "Chemistry", "Mathematics"],
            weeklyTests: "2 chapter-wise tests"
        };
    } else if (avgScore < 70) {
        return {
            focus: "Improve Problem Solving",
            dailyHours: "6-8 hours",
            priority: "Practice and speed",
            subjectsOrder: "Balance all subjects",
            weeklyTests: "1 full syllabus test + 2 chapter tests"
        };
    } else {
        return {
            focus: "Mastery and Revision",
            dailyHours: "8+ hours",
            priority: "Advanced problems and revision",
            subjectsOrder: "Focus on strong areas",
            weeklyTests: "2 full syllabus tests + revision"
        };
    }
}

function getOverallRecommendations(avgScore, weakSubjects) {
    const recommendations = [];
    
    if (avgScore < 60) {
        recommendations.push(
            "Focus on understanding basic concepts",
            "Practice easy and medium questions first",
            "Build strong foundation in weak subjects",
            "Regular revision is key"
        );
    } else {
        recommendations.push(
            "Practice time-bound tests",
            "Focus on accuracy and speed",
            "Solve previous year papers",
            "Regular mock tests for improvement"
        );
    }
    
    if (weakSubjects.length > 0) {
        recommendations.push(`Extra focus needed on: ${weakSubjects.join(', ')}`);
    }
    
    return recommendations;
}

function generateWeeklyTarget(weakSubjectCount) {
    return {
        chapters: weakSubjectCount > 0 ? weakSubjectCount * 2 : 4,
        questions: 200,
        tests: 3,
        revision: "All studied chapters"
    };
}

// Initialize with massive question bank
async function initializeMassiveQuestionBank() {
    try {
        const questionCount = await Question.countDocuments();
        if (questionCount === 0) {
            console.log('📚 Creating massive question bank like tayyari.in...');
            
            const massiveQuestions = [
                // Physics - 150 questions
                ...generateSubjectQuestions("Physics", "Mechanics", 50),
                ...generateSubjectQuestions("Physics", "Electricity and Magnetism", 40),
                ...generateSubjectQuestions("Physics", "Optics", 30),
                ...generateSubjectQuestions("Physics", "Thermodynamics", 20),
                ...generateSubjectQuestions("Physics", "Modern Physics", 10),
                
                // Chemistry - 140 questions
                ...generateSubjectQuestions("Chemistry", "Organic Chemistry", 50),
                ...generateSubjectQuestions("Chemistry", "Physical Chemistry", 40),
                ...generateSubjectQuestions("Chemistry", "Inorganic Chemistry", 40),
                ...generateSubjectQuestions("Chemistry", "Environmental Chemistry", 10),
                
                // Mathematics - 160 questions
                ...generateSubjectQuestions("Mathematics", "Calculus", 50),
                ...generateSubjectQuestions("Mathematics", "Algebra", 40),
                ...generateSubjectQuestions("Mathematics", "Coordinate Geometry", 35),
                ...generateSubjectQuestions("Mathematics", "Trigonometry", 25),
                ...generateSubjectQuestions("Mathematics", "Probability", 10)
            ];
            
            await Question.insertMany(massiveQuestions);
            console.log(`✅ Created massive bank of ${massiveQuestions.length} questions!`);
            
            // Create sample tests
            await createSampleTests();
            
            // Create study materials
            await createStudyMaterials();
        }
    } catch (error) {
        console.error('❌ Error creating question bank:', error);
    }
}

function generateSubjectQuestions(subject, chapter, count) {
    const questions = [];
    const difficulties = ['easy', 'medium', 'hard'];
    const exams = ['JEE Main', 'JEE Advanced'];
    
    for (let i = 1; i <= count; i++) {
        const difficulty = difficulties[Math.floor(Math.random() * difficulties.length)];
        const exam = exams[Math.floor(Math.random() * exams.length)];
        const marks = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;
        
        questions.push({
            question: `[${exam}] ${subject} - ${chapter} - Q${i}: ${getQuestionText(subject, chapter, difficulty)}`,
            options: [
                getOptionText(subject, chapter, 1),
                getOptionText(subject, chapter, 2),
                getOptionText(subject, chapter, 3),
                getOptionText(subject, chapter, 4)
            ],
            correctAnswer: Math.floor(Math.random() * 4),
            explanation: `Detailed explanation for ${subject} ${chapter} question ${i}`,
            solution: `Step-by-step solution for ${subject} ${chapter} question ${i}`,
            subject,
            chapter,
            topic: getTopic(subject, chapter),
            difficulty,
            marks,
            exam,
            year: 2020 + Math.floor(Math.random() * 4),
            source: `${exam} ${2020 + Math.floor(Math.random() * 4)}`,
            createdBy: "system"
        });
    }
    
    return questions;
}

function getQuestionText(subject, chapter, difficulty) {
    const templates = {
        Physics: {
            Mechanics: [
                "A particle moves with constant acceleration...",
                "A block of mass m is pulled on a rough surface...",
                "A circular disc of radius R is rotating...",
                "A projectile is fired at an angle θ..."
            ],
            "Electricity and Magnetism": [
                "In the circuit shown, find the current...",
                "A charged particle enters magnetic field...",
                "Calculate the capacitance of the system...",
                "Find the electric field at point P..."
            ]
        },
        Chemistry: {
            "Organic Chemistry": [
                "Identify the product of the reaction...",
                "Which compound shows optical activity?",
                "Predict the major product...",
                "Arrange in order of reactivity..."
            ],
            "Physical Chemistry": [
                "Calculate the pH of the solution...",
                "Find the rate constant for the reaction...",
                "Determine the equilibrium constant...",
                "Calculate the cell potential..."
            ]
        },
        Mathematics: {
            Calculus: [
                "Evaluate the integral ∫(x² + 1)dx...",
                "Find the derivative of f(x) = sin(x)...",
                "Solve the differential equation...",
                "Find the maximum value of the function..."
            ],
            Algebra: [
                "Solve the quadratic equation...",
                "Find the sum of the series...",
                "Determine the value of the expression...",
                "Solve the system of equations..."
            ]
        }
    };
    
    const subjectTemplates = templates[subject] || { default: ["Solve the following problem..."] };
    const chapterTemplates = subjectTemplates[chapter] || subjectTemplates.default;
    return chapterTemplates[Math.floor(Math.random() * chapterTemplates.length)];
}

function getOptionText(subject, chapter, optionNum) {
    const values = {
        Physics: ["2.5 m/s²", "5.6 × 10³", "8.31 J/mol·K", "6.02 × 10²³"],
        Chemistry: ["NaOH", "CH₃COOH", "NaCl", "H₂SO₄"],
        Mathematics: ["π/2", "√2", "ln(2)", "e²"]
    };
    
    const subjectValues = values[subject] || ["Option A", "Option B", "Option C", "Option D"];
    return `${subjectValues[optionNum - 1]}${optionNum === 1 ? ' (Correct)' : ''}`;
}

function getTopic(subject, chapter) {
    const topics = {
        Physics: {
            "Mechanics": ["Kinematics", "Dynamics", "Work-Energy", "Rotational Motion"],
            "Electricity and Magnetism": ["Electrostatics", "Current Electricity", "Magnetism", "EMI"]
        },
        Chemistry: {
            "Organic Chemistry": ["Hydrocarbons", "Functional Groups", "Reaction Mechanisms", "Stereochemistry"],
            "Physical Chemistry": ["Chemical Kinetics", "Thermodynamics", "Electrochemistry", "Solutions"]
        },
        Mathematics: {
            "Calculus": ["Differentiation", "Integration", "Differential Equations", "Applications"],
            "Algebra": ["Quadratic Equations", "Sequences", "Matrices", "Complex Numbers"]
        }
    };
    
    const subjectTopics = topics[subject] || { default: ["General"] };
    const chapterTopics = subjectTopics[chapter] || subjectTopics.default;
    return chapterTopics[Math.floor(Math.random() * chapterTopics.length)];
}

async function createSampleTests() {
    const testTypes = [
        {
            title: "JEE Main Full Syllabus Test 1",
            type: "full",
            subject: "Mixed",
            duration: 180,
            description: "Complete JEE Main syllabus practice test"
        },
        {
            title: "Physics Mechanics Chapter Test",
            type: "chapter",
            subject: "Physics",
            chapter: "Mechanics",
            duration: 60,
            description: "Comprehensive Mechanics chapter test"
        },
        {
            title: "Chemistry Organic Practice",
            type: "subject",
            subject: "Chemistry",
            duration: 90,
            description: "Organic chemistry focused test"
        }
    ];
    
    for (const testConfig of testTypes) {
        let filter = {};
        if (testConfig.subject && testConfig.subject !== 'Mixed') filter.subject = testConfig.subject;
        if (testConfig.chapter) filter.chapter = testConfig.chapter;
        
        const questions = await Question.find(filter).limit(30);
        if (questions.length > 0) {
            const test = new Test({
                ...testConfig,
                questions: questions.map(q => q._id),
                maxMarks: questions.reduce((sum, q) => sum + q.marks, 0),
                instructions: [
                    "All questions are compulsory",
                    "Each question carries marks as indicated",
                    "No negative marking",
                    "Use rough sheets for calculations"
                ],
                isPublic: true,
                createdBy: "system"
            });
            await test.save();
        }
    }
    console.log('✅ Created sample tests');
}

async function createStudyMaterials() {
    const materials = [
        {
            title: "Physics Formula Sheet",
            type: "formula",
            subject: "Physics",
            description: "All important Physics formulas for JEE"
        },
        {
            title: "Organic Chemistry Reactions",
            type: "notes",
            subject: "Chemistry",
            chapter: "Organic Chemistry",
            description: "Complete organic chemistry reactions guide"
        },
        {
            title: "Calculus Short Notes",
            type: "notes",
            subject: "Mathematics",
            chapter: "Calculus",
            description: "Quick revision notes for Calculus"
        }
    ];
    
    await StudyMaterial.insertMany(materials);
    console.log('✅ Created study materials');
}

async function initializeAdmin() {
    try {
        const adminExists = await User.findOne({ username: 'admin' });
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            const admin = new User({
                username: 'admin',
                password: hashedPassword,
                role: 'admin',
                profile: {
                    name: 'System Administrator',
                    targetExam: 'JEE Main'
                }
            });
            await admin.save();
            console.log('✅ Admin user created (username: admin, password: admin123)');
        }
        
        // Create demo student
        const studentExists = await User.findOne({ username: 'student' });
        if (!studentExists) {
            const hashedPassword = await bcrypt.hash('student123', 10);
            const student = new User({
                username: 'student',
                password: hashedPassword,
                role: 'student',
                profile: {
                    name: 'Demo Student',
                    targetExam: 'JEE Main',
                    class: '12th',
                    school: 'Demo School'
                }
            });
            await student.save();
            console.log('✅ Demo student created (username: student, password: student123)');
        }
    } catch (error) {
        console.error('Error creating users:', error);
    }
}

// Start server
app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📚 EduSphere - JEE/NEET Preparation Platform Ready!`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    
    if (mongoose.connection.readyState === 1) {
        await initializeAdmin();
        await initializeMassiveQuestionBank();
    }
});