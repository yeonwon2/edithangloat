// Project persistence and store management

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

class Store {
  static getProjects() {
    try {
      if (fs.existsSync(PROJECTS_FILE)) {
        const raw = fs.readFileSync(PROJECTS_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('Error reading projects.json:', e);
    }
    return [];
  }

  static saveProjects(projects) {
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2), 'utf-8');
  }

  static getProject(id) {
    const projects = this.getProjects();
    return projects.find(p => p.id === id) || null;
  }

  static saveProject(project) {
    const projects = this.getProjects();
    const index = projects.findIndex(p => p.id === project.id);
    if (index >= 0) {
      projects[index] = { ...projects[index], ...project, updatedAt: new Date().toISOString() };
    } else {
      projects.push({
        ...project,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    this.saveProjects(projects);
    return project;
  }

  static deleteProject(id) {
    let projects = this.getProjects();
    projects = projects.filter(p => p.id !== id);
    this.saveProjects(projects);
  }

  static getConfig() {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      }
    } catch (e) {
      console.error('Error reading config.json:', e);
    }
    return { apiKeys: [] };
  }

  static saveConfig(config) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  }
}

module.exports = Store;
