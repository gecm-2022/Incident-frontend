import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = 8080;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage (replace with database in production)
let incidents = [];
let idCounter = 1;

// AI Analysis Functions
const analyzeIncidentSeverity = (title, description) => {
  const text = `${title} ${description}`.toLowerCase();
  
  // Critical keywords
  if (text.includes('down') || text.includes('outage') || text.includes('critical') || 
      text.includes('security breach') || text.includes('data loss') || text.includes('crash')) {
    return 'CRITICAL';
  }
  
  // High severity keywords
  if (text.includes('error') || text.includes('failure') || text.includes('slow') || 
      text.includes('timeout') || text.includes('unavailable')) {
    return 'HIGH';
  }
  
  // Medium severity keywords
  if (text.includes('issue') || text.includes('problem') || text.includes('bug') || 
      text.includes('warning')) {
    return 'MEDIUM';
  }
  
  return 'LOW';
};

const analyzeIncidentCategory = (title, description, affectedService) => {
  const text = `${title} ${description} ${affectedService}`.toLowerCase();
  
  if (text.includes('security') || text.includes('breach') || text.includes('hack') || 
      text.includes('unauthorized') || text.includes('vulnerability')) {
    return 'SECURITY';
  }
  
  if (text.includes('network') || text.includes('connection') || text.includes('dns') || 
      text.includes('firewall') || text.includes('bandwidth')) {
    return 'NETWORK';
  }
  
  if (text.includes('database') || text.includes('sql') || text.includes('query') || 
      text.includes('data') || text.includes('storage')) {
    return 'DATABASE';
  }
  
  if (text.includes('frontend') || text.includes('ui') || text.includes('interface') || 
      text.includes('browser') || text.includes('css') || text.includes('javascript')) {
    return 'FRONTEND';
  }
  
  if (text.includes('hardware') || text.includes('server') || text.includes('disk') || 
      text.includes('memory') || text.includes('cpu')) {
    return 'HARDWARE';
  }
  
  return 'SOFTWARE';
};

const generateSuggestedAction = (severity, category, title, description) => {
  const actions = {
    CRITICAL: {
      SECURITY: "Immediately isolate affected systems, notify security team, and begin incident response protocol.",
      NETWORK: "Check network infrastructure, contact ISP if needed, and implement backup connectivity.",
      DATABASE: "Stop all write operations, check database integrity, and restore from latest backup if necessary.",
      FRONTEND: "Deploy rollback immediately, notify users of service disruption, and investigate root cause.",
      HARDWARE: "Replace failed hardware components immediately and check for data corruption.",
      SOFTWARE: "Rollback to previous stable version and investigate critical bug in isolated environment."
    },
    HIGH: {
      SECURITY: "Review security logs, patch vulnerabilities, and monitor for suspicious activity.",
      NETWORK: "Investigate network performance issues and optimize routing if needed.",
      DATABASE: "Optimize slow queries, check database performance metrics, and consider scaling.",
      FRONTEND: "Fix UI issues, test thoroughly, and deploy patch to production.",
      HARDWARE: "Monitor hardware health, schedule maintenance, and prepare replacement if needed.",
      SOFTWARE: "Debug the issue, implement fix, and test in staging environment before deployment."
    },
    MEDIUM: {
      SECURITY: "Schedule security audit and update security policies as needed.",
      NETWORK: "Monitor network performance and plan infrastructure improvements.",
      DATABASE: "Review database performance and plan optimization tasks.",
      FRONTEND: "Add to development backlog and prioritize based on user impact.",
      HARDWARE: "Schedule routine maintenance and monitor system health.",
      SOFTWARE: "Create bug ticket and assign to development team for next sprint."
    },
    LOW: {
      SECURITY: "Document security concern and review during next security meeting.",
      NETWORK: "Monitor and document for trend analysis.",
      DATABASE: "Add to maintenance backlog for future optimization.",
      FRONTEND: "Consider as enhancement for future releases.",
      HARDWARE: "Note for next maintenance window.",
      SOFTWARE: "Add to backlog as low-priority improvement."
    }
  };
  
  return actions[severity][category] || "Review incident details and assign to appropriate team for investigation.";
};

const calculateConfidenceScore = (title, description) => {
  let confidence = 0.5; // Base confidence
  
  // Increase confidence based on detail level
  if (description.length > 100) confidence += 0.2;
  if (description.length > 300) confidence += 0.1;
  
  // Increase confidence for specific technical terms
  const technicalTerms = ['error', 'exception', 'timeout', 'failure', 'crash', 'bug', 'issue'];
  const text = `${title} ${description}`.toLowerCase();
  const termCount = technicalTerms.filter(term => text.includes(term)).length;
  confidence += Math.min(termCount * 0.1, 0.3);
  
  return Math.min(confidence, 1.0);
};

// Routes

// Get all incidents with pagination and filtering
app.get('/api/incidents', (req, res) => {
  const { page = 0, size = 10, severity, category, sortBy = 'createdAt', sortDir = 'desc' } = req.query;
  
  let filteredIncidents = [...incidents];
  
  // Apply filters
  if (severity) {
    filteredIncidents = filteredIncidents.filter(incident => incident.aiSeverity === severity);
  }
  
  if (category) {
    filteredIncidents = filteredIncidents.filter(incident => incident.aiCategory === category);
  }
  
  // Sort incidents
  filteredIncidents.sort((a, b) => {
    const aValue = a[sortBy];
    const bValue = b[sortBy];
    
    if (sortDir === 'desc') {
      return new Date(bValue) - new Date(aValue);
    } else {
      return new Date(aValue) - new Date(bValue);
    }
  });
  
  // Pagination
  const startIndex = parseInt(page) * parseInt(size);
  const endIndex = startIndex + parseInt(size);
  const paginatedIncidents = filteredIncidents.slice(startIndex, endIndex);
  
  res.json({
    content: paginatedIncidents,
    number: parseInt(page),
    size: parseInt(size),
    totalElements: filteredIncidents.length,
    totalPages: Math.ceil(filteredIncidents.length / parseInt(size))
  });
});

// Get single incident by ID
app.get('/api/incidents/:id', (req, res) => {
  const incident = incidents.find(i => i.id === parseInt(req.params.id));
  
  if (!incident) {
    return res.status(404).json({ message: 'Incident not found' });
  }
  
  res.json(incident);
});

// Create new incident
app.post('/api/incidents', (req, res) => {
  const { title, description, affectedService } = req.body;
  
  // Validation
  if (!title || !description || !affectedService) {
    return res.status(400).json({ message: 'Title, description, and affected service are required' });
  }
  
  // AI Analysis
  const aiSeverity = analyzeIncidentSeverity(title, description);
  const aiCategory = analyzeIncidentCategory(title, description, affectedService);
  const aiSuggestedAction = generateSuggestedAction(aiSeverity, aiCategory, title, description);
  const confidenceScore = calculateConfidenceScore(title, description);
  
  const newIncident = {
    id: idCounter++,
    title,
    description,
    affectedService,
    status: 'OPEN',
    aiSeverity,
    aiCategory,
    aiSuggestedAction,
    confidenceScore,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  incidents.push(newIncident);
  res.status(201).json(newIncident);
});

// Update incident status
app.put('/api/incidents/:id/status', (req, res) => {
  const { status } = req.query;
  const incident = incidents.find(i => i.id === parseInt(req.params.id));
  
  if (!incident) {
    return res.status(404).json({ message: 'Incident not found' });
  }
  
  if (!['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }
  
  incident.status = status;
  incident.updatedAt = new Date().toISOString();
  
  res.json(incident);
});

// Get incident statistics
app.get('/api/incidents/stats', (req, res) => {
  const stats = {
    total: incidents.length,
    severity: {},
    category: {},
    status: {}
  };
  
  incidents.forEach(incident => {
    // Severity stats
    stats.severity[incident.aiSeverity] = (stats.severity[incident.aiSeverity] || 0) + 1;
    
    // Category stats
    stats.category[incident.aiCategory] = (stats.category[incident.aiCategory] || 0) + 1;
    
    // Status stats
    stats.status[incident.status] = (stats.status[incident.status] || 0) + 1;
  });
  
  res.json(stats);
});

// Add some sample data
const sampleIncidents = [
  {
    id: idCounter++,
    title: "Database connection timeout",
    description: "Users are experiencing slow response times when accessing the user dashboard. Database queries are timing out after 30 seconds.",
    affectedService: "user-dashboard",
    status: "OPEN",
    aiSeverity: "HIGH",
    aiCategory: "DATABASE",
    aiSuggestedAction: "Optimize slow queries, check database performance metrics, and consider scaling.",
    confidenceScore: 0.85,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  },
  {
    id: idCounter++,
    title: "Security vulnerability in authentication service",
    description: "Potential SQL injection vulnerability discovered in the login endpoint. This could allow unauthorized access to user accounts.",
    affectedService: "authentication-service",
    status: "IN_PROGRESS",
    aiSeverity: "CRITICAL",
    aiCategory: "SECURITY",
    aiSuggestedAction: "Immediately isolate affected systems, notify security team, and begin incident response protocol.",
    confidenceScore: 0.95,
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
    updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString() // 1 hour ago
  },
  {
    id: idCounter++,
    title: "Frontend CSS styling issue",
    description: "The navigation menu is not displaying correctly on mobile devices. Users report that menu items are overlapping.",
    affectedService: "web-frontend",
    status: "RESOLVED",
    aiSeverity: "MEDIUM",
    aiCategory: "FRONTEND",
    aiSuggestedAction: "Review database performance and plan optimization tasks.",
    confidenceScore: 0.75,
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
    updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString() // 30 minutes ago
  }
];

incidents.push(...sampleIncidents);

app.listen(PORT, () => {
  console.log(`🚀 AI Incident Triage Backend running on http://localhost:${PORT}`);
  console.log(`📊 Sample incidents loaded: ${incidents.length}`);
});