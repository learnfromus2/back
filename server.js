const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// In-memory storage (in production, use a database)
let users = [
    { id: 1, username: 'admin', password: 'admin123', role: 'admin' },
    { id: 2, username: 'teacher', password: 'teacher123', role: 'teacher' },
    { id: 3, username: 'student', password: 'student123', role: 'student' }
];

let questionBank = {
    physics: {
        "9": {
            "Motion": {
                easy: [
                    {
                        id: 1,
                        text: "What is the SI unit of speed?",
                        optionA: "m/s",
                        optionB: "km/h",
                        optionC: "m/s²",
                        optionD: "km/s",
                        correctAnswer: "A",
                        solution: "Speed is defined as distance traveled per unit time. The SI unit of distance is meter (m) and time is second (s), so the SI unit of speed is meter per second (m/s)."
                    },
                    {
                        id: 2,
                        text: "Which of the following is a vector quantity?",
                        optionA: "Speed",
                        optionB: "Distance",
                        optionC: "Velocity",
                        optionD: "Time",
                        correctAnswer: "C",
                        solution: "Velocity is a vector quantity because it has both magnitude and direction. Speed, distance, and time are scalar quantities as they have only magnitude."
                    }
                ],
                medium: [
                    {
                        id: 3,
                        text: "A car accelerates from 20 m/s to 40 m/s in 5 seconds. What is its acceleration?",
                        optionA: "2 m/s²",
                        optionB: "4 m/s²",
                        optionC: "6 m/s²",
                        optionD: "8 m/s²",
                        correctAnswer: "B",
                        solution: "Acceleration = (Final velocity - Initial velocity) / Time = (40 - 20) / 5 = 20 / 5 = 4 m/s²"
                    }
                ],
                hard: [
                    {
                        id: 4,
                        text: "A ball is thrown vertically upwards with a velocity of 49 m/s. Calculate the maximum height reached by the ball. (g = 9.8 m/s²)",
                        optionA: "122.5 m",
                        optionB: "245 m",
                        optionC: "49 m",
                        optionD: "98 m",
                        correctAnswer: "A",
                        solution: "Using the formula: h = u²/(2g) = (49)²/(2×9.8) = 2401/19.6 = 122.5 m"
                    }
                ]
            }
        }
    },
    chemistry: {
        "9": {
            "Atoms and Molecules": {
                easy: [
                    {
                        id: 5,
                        text: "What is the atomicity of oxygen molecule?",
                        optionA: "1",
                        optionB: "2",
                        optionC: "3",
                        optionD: "4",
                        correctAnswer: "B",
                        solution: "Oxygen molecule (O₂) consists of two oxygen atoms, so its atomicity is 2."
                    }
                ]
            }
        }
    },
    mathematics: {
        "9": {
            "Algebra": {
                easy: [
                    {
                        id: 6,
                        text: "What is the value of x in the equation 2x + 5 = 15?",
                        optionA: "5",
                        optionB: "10",
                        optionC: "7.5",
                        optionD: "2.5",
                        correctAnswer: "A",
                        solution: "2x + 5 = 15 ⇒ 2x = 15 - 5 ⇒ 2x = 10 ⇒ x = 5"
                    }
                ]
            }
        }
    },
    biology: {
        "9": {
            "Cell Biology": {
                easy: [
                    {
                        id: 7,
                        text: "Which organelle is called the powerhouse of the cell?",
                        optionA: "Nucleus",
                        optionB: "Mitochondria",
                        optionC: "Ribosome",
                        optionD: "Golgi apparatus",
                        correctAnswer: "B",
                        solution: "Mitochondria are called the powerhouse of the cell because they produce ATP (adenosine triphosphate) through cellular respiration, which provides energy for various cellular activities."
                    }
                ]
            }
        }
    }
};

let tests = [
    {
        id: 1,
        title: "Class 9 Physics - Motion",
        subject: "physics",
        class: "9",
        chapter: "Motion",
        difficulty: "mixed",
        duration: 30,
        questionCount: 10
    },
    {
        id: 2,
        title: "Class 11 Chemistry - Organic Chemistry",
        subject: "chemistry",
        class: "11",
        chapter: "Organic Chemistry",
        difficulty: "medium",
        duration: 45,
        questionCount: 15
    }
];

let testResults = {};

// Authentication middleware
const authenticate = (req, res, next) => {
    const token = req.headers.authorization;
    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    next();
};

// Routes

// User authentication
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            },
            token: 'mock-jwt-token-' + user.id
        });
    } else {
        res.status(401).json({
            success: false,
            error: 'Invalid username or password'
        });
    }
});

app.post('/api/register', (req, res) => {
    const { username, password, role } = req.body;
    
    if (users.find(u => u.username === username)) {
        return res.status(400).json({
            success: false,
            error: 'Username already exists'
        });
    }
    
    const newUser = {
        id: users.length + 1,
        username,
        password,
        role: role || 'student'
    };
    
    users.push(newUser);
    
    res.json({
        success: true,
        user: {
            id: newUser.id,
            username: newUser.username,
            role: newUser.role
        },
        token: 'mock-jwt-token-' + newUser.id
    });
});

// Question bank management
app.get('/api/questions', authenticate, (req, res) => {
    const { subject, class: classLevel, chapter, difficulty } = req.query;
    
    let filteredQuestions = questionBank;
    
    if (subject) {
        filteredQuestions = filteredQuestions[subject] || {};
    }
    if (classLevel && filteredQuestions[classLevel]) {
        filteredQuestions = filteredQuestions[classLevel];
    }
    if (chapter && filteredQuestions[chapter]) {
        filteredQuestions = filteredQuestions[chapter];
    }
    if (difficulty && filteredQuestions[difficulty]) {
        filteredQuestions = filteredQuestions[difficulty];
    }
    
    res.json({ questions: filteredQuestions });
});

app.post('/api/questions', authenticate, (req, res) => {
    const { subject, class: classLevel, chapter, difficulty, question } = req.body;
    
    // Check if user is admin
    const token = req.headers.authorization;
    const userId = token.split('-').pop();
    const user = users.find(u => u.id == userId);
    
    if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admin can add questions' });
    }
    
    // Initialize structure if needed
    if (!questionBank[subject]) questionBank[subject] = {};
    if (!questionBank[subject][classLevel]) questionBank[subject][classLevel] = {};
    if (!questionBank[subject][classLevel][chapter]) questionBank[subject][classLevel][chapter] = {};
    if (!questionBank[subject][classLevel][chapter][difficulty]) {
        questionBank[subject][classLevel][chapter][difficulty] = [];
    }
    
    // Add question
    const newQuestion = {
        id: Date.now(),
        ...question
    };
    
    questionBank[subject][classLevel][chapter][difficulty].push(newQuestion);
    
    res.json({ success: true, question: newQuestion });
});

app.delete('/api/questions/:id', authenticate, (req, res) => {
    const questionId = parseInt(req.params.id);
    
    // Check if user is admin
    const token = req.headers.authorization;
    const userId = token.split('-').pop();
    const user = users.find(u => u.id == userId);
    
    if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admin can delete questions' });
    }
    
    // Find and delete question
    let deleted = false;
    Object.keys(questionBank).forEach(subject => {
        Object.keys(questionBank[subject]).forEach(classLevel => {
            Object.keys(questionBank[subject][classLevel]).forEach(chapter => {
                Object.keys(questionBank[subject][classLevel][chapter]).forEach(difficulty => {
                    const index = questionBank[subject][classLevel][chapter][difficulty].findIndex(q => q.id === questionId);
                    if (index !== -1) {
                        questionBank[subject][classLevel][chapter][difficulty].splice(index, 1);
                        deleted = true;
                    }
                });
            });
        });
    });
    
    if (deleted) {
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Question not found' });
    }
});

// Test management
app.get('/api/tests', authenticate, (req, res) => {
    res.json({ tests });
});

app.post('/api/tests', authenticate, (req, res) => {
    const { title, subject, class: classLevel, chapter, difficulty, duration, questionCount, questions } = req.body;
    
    const newTest = {
        id: tests.length + 1,
        title,
        subject,
        class: classLevel,
        chapter,
        difficulty,
        duration,
        questionCount,
        questions: questions || []
    };
    
    tests.push(newTest);
    res.json({ success: true, test: newTest });
});

app.get('/api/tests/:id', authenticate, (req, res) => {
    const testId = parseInt(req.params.id);
    const test = tests.find(t => t.id === testId);
    
    if (test) {
        // If test doesn't have questions, generate them from question bank
        if (!test.questions || test.questions.length === 0) {
            test.questions = generateQuestionsForTest(test);
        }
        res.json({ test });
    } else {
        res.status(404).json({ error: 'Test not found' });
    }
});

function generateQuestionsForTest(test) {
    let questions = [];
    
    if (questionBank[test.subject] && questionBank[test.subject][test.class] && questionBank[test.subject][test.class][test.chapter]) {
        const chapterQuestions = questionBank[test.subject][test.class][test.chapter];
        
        if (test.difficulty === 'mixed') {
            Object.keys(chapterQuestions).forEach(difficulty => {
                questions = questions.concat(chapterQuestions[difficulty]);
            });
        } else {
            questions = chapterQuestions[test.difficulty] || [];
        }
        
        // Limit to requested number of questions
        questions = questions.slice(0, test.questionCount);
    }
    
    return questions;
}

// Test results
app.post('/api/test-results', authenticate, (req, res) => {
    const { testId, answers, timeSpent } = req.body;
    
    const token = req.headers.authorization;
    const userId = token.split('-').pop();
    
    if (!testResults[userId]) {
        testResults[userId] = [];
    }
    
    const test = tests.find(t => t.id === testId);
    if (!test) {
        return res.status(404).json({ error: 'Test not found' });
    }
    
    // Calculate score
    let score = 0;
    test.questions.forEach((question, index) => {
        if (answers[index] === question.correctAnswer) {
            score++;
        }
    });
    
    const percentage = (score / test.questions.length * 100).toFixed(1);
    
    const result = {
        testId,
        testTitle: test.title,
        score,
        totalQuestions: test.questions.length,
        percentage,
        timeSpent,
        timestamp: new Date().toISOString(),
        answers
    };
    
    testResults[userId].push(result);
    
    res.json({ success: true, result });
});

app.get('/api/test-results', authenticate, (req, res) => {
    const token = req.headers.authorization;
    const userId = token.split('-').pop();
    
    const results = testResults[userId] || [];
    res.json({ results });
});

// AI Guidance (mock implementation)
app.post('/api/ai-guidance', authenticate, (req, res) => {
    const { topic } = req.body;
    
    // Mock AI response
    const guidance = {
        topic,
        content: `Based on your performance and the topic "${topic}", here are some personalized recommendations:
        
        <strong>Key Areas to Focus:</strong>
        <ul>
            <li>Fundamental concepts and definitions</li>
            <li>Problem-solving techniques</li>
            <li>Common misconceptions to avoid</li>
            <li>Important formulas and their applications</li>
        </ul>
        
        <strong>Recommended Resources:</strong>
        <ul>
            <li>NCERT textbooks for basic concepts</li>
            <li>Practice worksheets for application</li>
            <li>Previous year questions for exam pattern</li>
        </ul>
        
        <strong>Study Plan:</strong>
        <ol>
            <li>Spend 30 minutes daily on theory</li>
            <li>Solve 10-15 practice problems</li>
            <li>Take weekly topic tests</li>
            <li>Revise with flashcards</li>
        </ol>`,
        difficulty: "Medium",
        importance: "8/10",
        estimatedTime: "2-3 weeks"
    };
    
    // Simulate processing delay
    setTimeout(() => {
        res.json({ guidance });
    }, 1500);
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