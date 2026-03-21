/**
 * Nurse ClinIQ – Main server.
 * Express API for student login, dashboard, quizzes, and admin panel.
 * Uses JSON file store (no native DB dependency).
 * Load .env for OPENAI_API_KEY (optional AI quiz generation).
 */
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const store = require('./lib/store');
const { hashPassword, verifyPassword } = require('./lib/auth');
const { generateQuizQuestions } = require('./lib/openai');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const JWT_SECRET = process.env.JWT_SECRET || 'nurse-cliniq-demo-secret-change-in-production';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ----- Auth middleware -----
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function adminMiddleware(req, res, next) {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// ----- Auth routes -----
app.post('/api/auth/register', (req, res) => {
  const { student_number, name, password, email } = req.body || {};
  if (!student_number || !name || !password) {
    return res.status(400).json({ error: 'Student number, name, and password are required' });
  }
  if (store.getStudentByNumber(student_number.trim())) {
    return res.status(400).json({ error: 'Student number already registered' });
  }
  const password_hash = hashPassword(password);
  const row = store.addStudent({
    student_number: student_number.trim(),
    name: name.trim(),
    email: email ? email.trim() : null,
    password_hash,
    is_admin: 0
  });
  store.ensureStudentCompetencyRows(row.student_id);
  const student = { student_id: row.student_id, student_number: row.student_number, name: row.name, email: row.email, is_admin: 0 };
  const token = jwt.sign(
    { student_id: row.student_id, student_number: row.student_number, is_admin: 0 },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.json({ token, user: student });
});

app.post('/api/auth/login', (req, res) => {
  const { student_number, password } = req.body || {};
  if (!student_number || !password) {
    return res.status(400).json({ error: 'Student number and password are required' });
  }
  const student = store.getStudentByNumber(student_number.trim());
  if (!student || !verifyPassword(password, student.password_hash)) {
    return res.status(401).json({ error: 'Invalid student number or password' });
  }
  store.ensureStudentCompetencyRows(student.student_id);
  const token = jwt.sign(
    { student_id: student.student_id, student_number: student.student_number, is_admin: student.is_admin ? 1 : 0 },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.json({
    token,
    user: {
      student_id: student.student_id,
      student_number: student.student_number,
      name: student.name,
      email: student.email,
      is_admin: student.is_admin ? 1 : 0
    }
  });
});

// ----- Student routes (protected) -----
app.get('/api/me', authMiddleware, (req, res) => {
  const u = store.getStudentById(req.user.student_id);
  if (!u) return res.status(404).json({ error: 'User not found' });
  res.json({ student_id: u.student_id, student_number: u.student_number, name: u.name, email: u.email, is_admin: u.is_admin ? 1 : 0 });
});

app.get('/api/competencies', authMiddleware, (req, res) => {
  res.json(store.getCompetencies());
});

app.get('/api/my-progress', authMiddleware, (req, res) => {
  const progress = store.getProgressByStudent(req.user.student_id);
  const competencies = store.getCompetencies();
  const compMap = Object.fromEntries(competencies.map(c => [c.competency_id, c]));
  const rows = progress.map(p => ({
    competency_id: p.competency_id,
    name: compMap[p.competency_id]?.name,
    description: compMap[p.competency_id]?.description,
    status: p.status,
    result: p.result,
    quiz_score: p.quiz_score,
    last_attempt: p.last_attempt
  }));
  // One row per competency: keep latest by last_attempt to avoid duplicates
  const byComp = new Map();
  for (const r of rows) {
    const existing = byComp.get(r.competency_id);
    const rTime = r.last_attempt ? new Date(r.last_attempt).getTime() : 0;
    const exTime = existing && existing.last_attempt ? new Date(existing.last_attempt).getTime() : 0;
    if (!existing || rTime >= exTime) byComp.set(r.competency_id, r);
  }
  res.json([...byComp.values()]);
});

app.get('/api/quiz/:competencyId', authMiddleware, (req, res) => {
  const competencyId = parseInt(req.params.competencyId, 10);
  const questions = store.getQuizzesByCompetency(competencyId).map(q => {
    const { correct_answer, ...rest } = q;
    return rest;
  });
  res.json(questions);
});

app.post('/api/quiz/:competencyId/submit', authMiddleware, (req, res) => {
  const competencyId = parseInt(req.params.competencyId, 10);
  const answers = req.body.answers || [];
  const questions = store.getQuizzesByCompetency(competencyId);
  let correct = 0;
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const userAnswer = answers[i];
    let correctAnswer = q.correct_answer;
    if (typeof q.correct_answer === 'string') {
      const s = q.correct_answer.trim();
      if (s.startsWith('[') || s.startsWith('{') || s.startsWith('"')) {
        try { correctAnswer = JSON.parse(q.correct_answer); } catch (_) { correctAnswer = q.correct_answer; }
      } else {
        correctAnswer = q.correct_answer;
      }
    }
    let ok = false;
    if (q.question_type === 'multiple-choice') {
      ok = Array.isArray(correctAnswer) ? correctAnswer.includes(userAnswer) : String(userAnswer) === String(correctAnswer);
    } else if (q.question_type === 'matching') {
      const userObj = typeof userAnswer === 'object' ? userAnswer : {};
      ok = Object.keys(correctAnswer).every(k => userObj[k] === correctAnswer[k]);
    } else if (q.question_type === 'drag-drop') {
      ok = Array.isArray(correctAnswer) && Array.isArray(userAnswer) &&
        correctAnswer.length === userAnswer.length &&
        correctAnswer.every((v, j) => String(v) === String(userAnswer[j]));
    }
    if (ok) correct++;
  }
  const score = questions.length ? Math.round((correct / questions.length) * 100) : 0;
  const result = score >= 70 ? 'Pass' : 'Fail';
  store.updateProgress(req.user.student_id, competencyId, {
    status: 'Completed',
    result,
    quiz_score: score,
    last_attempt: new Date().toISOString()
  });
  res.json({ score, result, correct, total: questions.length });
});

// ----- Admin routes -----
app.get('/api/admin/students', authMiddleware, adminMiddleware, (req, res) => {
  const list = store.getStudents().map(s => ({
    student_id: s.student_id,
    student_number: s.student_number,
    name: s.name,
    email: s.email,
    is_admin: s.is_admin,
    registration_date: s.registration_date
  }));
  res.json(list);
});

app.get('/api/admin/student-progress', authMiddleware, adminMiddleware, (req, res) => {
  const studentId = req.query.student_id;
  const competencies = store.getCompetencies();
  const totalCompetencies = competencies.length;
  if (!studentId) {
    const students = store.getStudents().filter(s => !s.is_admin);
    const sc = store.getStudentCompetency();
    const all = students.map(s => {
      const mySc = sc.filter(x => x.student_id === s.student_id);
      const completed_count = mySc.filter(x => x.status === 'Completed').length;
      const pass_count = mySc.filter(x => x.result === 'Pass').length;
      return {
        student_id: s.student_id,
        student_number: s.student_number,
        name: s.name,
        completed_count,
        pass_count,
        total_competencies: totalCompetencies
      };
    });
    return res.json(all);
  }
  const progress = store.getProgressByStudent(parseInt(studentId, 10));
  const compMap = Object.fromEntries(competencies.map(c => [c.competency_id, c]));
  const rows = progress.map(p => ({
    competency_id: p.competency_id,
    name: compMap[p.competency_id]?.name,
    status: p.status,
    result: p.result,
    quiz_score: p.quiz_score,
    last_attempt: p.last_attempt
  }));
  res.json(rows);
});

app.get('/api/admin/competencies', authMiddleware, adminMiddleware, (req, res) => {
  res.json(store.getCompetencies());
});

app.post('/api/admin/competencies', authMiddleware, adminMiddleware, (req, res) => {
  const { name, description } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const row = store.addCompetency({ name: name.trim(), description: description ? description.trim() : null });
  const students = store.getStudents();
  for (const s of students) {
    store.ensureStudentCompetencyRows(s.student_id);
  }
  res.status(201).json({ competency_id: row.competency_id, name: row.name, description: row.description });
});

app.put('/api/admin/competencies/:id', authMiddleware, adminMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { name, description } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const row = store.updateCompetency(id, { name: name.trim(), description: description ? description.trim() : null });
  if (!row) return res.status(404).json({ error: 'Competency not found' });
  res.json({ competency_id: id, name: row.name, description: row.description });
});

app.delete('/api/admin/competencies/:id', authMiddleware, adminMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  store.deleteCompetency(id);
  res.json({ deleted: id });
});

app.get('/api/admin/quizzes/:competencyId', authMiddleware, adminMiddleware, (req, res) => {
  const competencyId = parseInt(req.params.competencyId, 10);
  const list = store.getQuizzesByCompetency(competencyId);
  res.json(list);
});

app.post('/api/admin/quizzes', authMiddleware, adminMiddleware, (req, res) => {
  const { competency_id, question_text, question_type, options, correct_answer, sort_order } = req.body || {};
  if (!competency_id || !question_text || !question_type) {
    return res.status(400).json({ error: 'competency_id, question_text, and question_type are required' });
  }
  const row = store.addQuiz({
    competency_id,
    question_text,
    question_type,
    options: options || [],
    correct_answer: correct_answer !== undefined ? correct_answer : []
  });
  if (sort_order != null) store.updateQuiz(row.quiz_id, { sort_order });
  res.status(201).json({ quiz_id: row.quiz_id });
});

app.put('/api/admin/quizzes/:id', authMiddleware, adminMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { question_text, question_type, options, correct_answer, sort_order } = req.body || {};
  const row = store.getQuizById(id);
  if (!row) return res.status(404).json({ error: 'Quiz not found' });
  const updates = {};
  if (question_text != null) updates.question_text = question_text;
  if (question_type != null) updates.question_type = question_type;
  if (options != null) updates.options = options;
  if (correct_answer !== undefined) updates.correct_answer = correct_answer;
  if (sort_order != null) updates.sort_order = sort_order;
  store.updateQuiz(id, updates);
  res.json({ quiz_id: id });
});

app.delete('/api/admin/quizzes/:id', authMiddleware, adminMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  store.deleteQuiz(id);
  res.json({ deleted: id });
});

// ----- AI: Generate quiz questions via OpenAI -----
app.post('/api/admin/ai/generate-questions', authMiddleware, adminMiddleware, async (req, res) => {
  const { competency_id, count } = req.body || {};
  if (!competency_id) {
    return res.status(400).json({ error: 'competency_id is required' });
  }
  const competency = store.getCompetencyById(parseInt(competency_id, 10));
  if (!competency) {
    return res.status(404).json({ error: 'Competency not found' });
  }
  try {
    const questions = await generateQuizQuestions(
      competency.name,
      competency.description || '',
      typeof count === 'number' ? count : 3
    );
    const added = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const row = store.addQuiz({
        competency_id: competency.competency_id,
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.options,
        correct_answer: q.correct_answer,
        sort_order: i
      });
      added.push({ quiz_id: row.quiz_id, question_text: q.question_text, question_type: q.question_type });
    }
    res.json({ message: `Added ${added.length} question(s)`, added });
  } catch (err) {
    console.error('OpenAI generate-questions error:', err.message);
    res.status(500).json({
      error: err.message || 'Failed to generate questions',
      hint: process.env.OPENAI_API_KEY ? 'Check OpenAI API key and quota.' : 'Set OPENAI_API_KEY in .env'
    });
  }
});

app.post('/api/admin/students', authMiddleware, adminMiddleware, (req, res) => {
  const { student_number, name, password, email } = req.body || {};
  if (!student_number || !name || !password) {
    return res.status(400).json({ error: 'Student number, name, and password are required' });
  }
  if (store.getStudentByNumber(student_number.trim())) {
    return res.status(400).json({ error: 'Student number already exists' });
  }
  const row = store.addStudent({
    student_number: student_number.trim(),
    name: name.trim(),
    email: email ? email.trim() : null,
    password_hash: hashPassword(password),
    is_admin: 0
  });
  store.ensureStudentCompetencyRows(row.student_id);
  res.status(201).json({ student_id: row.student_id, student_number: row.student_number, name: row.name, email: row.email, is_admin: 0 });
});

app.put('/api/admin/students/:id/reset-password', authMiddleware, adminMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'New password is required' });
  store.updateStudent(id, { password_hash: hashPassword(password) });
  res.json({ message: 'Password updated' });
});

app.delete('/api/admin/students/:id', authMiddleware, adminMiddleware, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid student id' });
  const student = store.getStudentById(id);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  if (student.is_admin) return res.status(403).json({ error: 'Cannot delete admin accounts' });
  store.deleteStudent(id);
  res.json({ message: 'Student deleted' });
});

app.get('/api/admin/reports/export', authMiddleware, adminMiddleware, (req, res) => {
  const format = (req.query.format || 'json').toLowerCase();
  const students = store.getStudents().filter(s => !s.is_admin);
  const progress = store.getStudentCompetency();
  const competencies = store.getCompetencies();
  const compMap = Object.fromEntries(competencies.map(c => [c.competency_id, c.name]));
  const byStudent = students.map(s => ({
    student_id: s.student_id,
    student_number: s.student_number,
    name: s.name,
    email: s.email,
    competencies: progress.filter(p => p.student_id === s.student_id).map(p => ({
      competency: compMap[p.competency_id],
      status: p.status,
      result: p.result,
      quiz_score: p.quiz_score,
      last_attempt: p.last_attempt
    }))
  }));

  if (format === 'csv') {
    const header = 'student_id,student_number,name,email,competency,status,result,quiz_score,last_attempt';
    const rows = byStudent.flatMap(s =>
      s.competencies.map(c => [s.student_id, s.student_number, `"${(s.name || '').replace(/"/g, '""')}"`, s.email || '', `"${(c.competency || '').replace(/"/g, '""')}"`, c.status, c.result || '', c.quiz_score || '', c.last_attempt || ''].join(','))
    );
    const csv = [header, ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=student-performance.csv');
    return res.send(csv);
  }
  res.json(byStudent);
});

// SPA fallback: serve index.html for non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server; if port is in use, try next port (up to 3010)
const http = require('http');
function tryListen(port) {
  if (port > 3010) {
    console.error('No available port between ' + PORT + ' and 3010. Free a port or set PORT.');
    process.exit(1);
  }
  const server = http.createServer(app);
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log('Port ' + port + ' in use, trying ' + (port + 1) + '...');
      tryListen(port + 1);
    } else {
      throw err;
    }
  });
  server.listen(port, HOST, () => {
    console.log('Nurse ClinIQ server listening on http://' + HOST + ':' + port);
    if (process.env.PUBLIC_URL) {
      console.log('Public URL: ' + process.env.PUBLIC_URL);
    } else if (process.env.PUBLIC_HOST) {
      console.log('Public URL: http://' + process.env.PUBLIC_HOST + ':' + port);
    }
  });
}
tryListen(PORT);
