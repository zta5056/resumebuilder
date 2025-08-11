// Global variables
let isProcessing = false;
let resumeData = {};
let currentTemplate = 'classic';

// Dynamic sections management
let experienceEntries = [];
let experienceCounter = 0;
let educationEntries = [];
let educationCounter = 0;
let projectEntries = [];
let projectCounter = 0;

// Advanced features
let atsScore = 0;
let progressData = {
    personal: 0,
    summary: 0,
    experience: 0,
    education: 0,
    projects: 0,
    skills: 0
};

// Auto-save functionality
let autoSaveTimeout;

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM loaded, initializing resume builder...');
    
    // Initialize all sections in order
    initializeTemplateSelector();
    initializeDynamicSections();
    initializeFormInputs();
    initializeButtons();
    
    // Load saved data and initialize advanced features
    loadSavedData().then(() => {
        setTimeout(initializeAdvancedFeatures, 500);
        updatePreview();
    });
});

// ===== TEMPLATE MANAGEMENT =====
function initializeTemplateSelector() {
    const templateSelect = document.getElementById('template-select');
    if (!templateSelect) return;
    
    currentTemplate = templateSelect.value;
    console.log('Initial template:', currentTemplate);
    
    templateSelect.addEventListener('change', function() {
        console.log('Template changed to:', this.value);
        currentTemplate = this.value;
        
        const previewElement = document.getElementById('resume-preview');
        if (previewElement) {
            previewElement.className = `resume-preview ${currentTemplate}-template`;
        }
        
        updatePreview();
        autoSave();
    });
}

// ===== DYNAMIC SECTIONS INITIALIZATION =====
function initializeDynamicSections() {
    initializeExperienceSection();
    initializeEducationSection();
    initializeProjectsSection();
}

// ===== FORM INPUTS INITIALIZATION =====
function initializeFormInputs() {
    const inputs = document.querySelectorAll('input, textarea');
    console.log('Found', inputs.length, 'input elements');
    
    inputs.forEach(input => {
        // Avoid duplicate listeners by checking if already initialized
        if (input.dataset.initialized) return;
        input.dataset.initialized = 'true';
        
        input.addEventListener('input', function() {
            updatePreview();
            autoSave();
        });
        
        input.addEventListener('focus', function() {
            this.style.borderColor = 'var(--primary)';
        });
    });
}

// ===== BUTTONS INITIALIZATION =====
function initializeButtons() {
    const exportBtn = document.getElementById('export-pdf-btn');
    const saveBtn = document.getElementById('save-btn');
    const clearBtn = document.getElementById('clear-btn');
    
    if (exportBtn) exportBtn.addEventListener('click', exportToPDF);
    if (saveBtn) saveBtn.addEventListener('click', () => {
        if (validateForm()) saveResume();
    });
    if (clearBtn) clearBtn.addEventListener('click', clearAllContent);
}

// ===== DATA MANAGEMENT =====
async function loadSavedData() {
    try {
        const response = await fetch('/get_resume_data');
        const savedData = await response.json();
        
        if (!savedData || Object.keys(savedData).length === 0) return;
        
        console.log('Loading saved data:', savedData);
        
        // Load personal info fields
        if (savedData.personal_info) {
            const personalFields = ['name', 'title', 'email', 'phone', 'location', 'linkedin', 'website', 'github'];
            personalFields.forEach(field => {
                const element = document.getElementById(field);
                if (element && savedData.personal_info[field]) {
                    element.value = savedData.personal_info[field];
                }
            });
        }
        
        // Load text fields
        if (savedData.summary) setElementValue('summary-input', savedData.summary);
        if (savedData.skills) setElementValue('skills-input', savedData.skills);
        
        // Load dynamic sections
        if (savedData.experience) loadExperienceEntries(savedData.experience);
        if (savedData.education) loadEducationEntries(savedData.education);
        if (savedData.projects) loadProjectEntries(savedData.projects);
        
        // Set template
        if (savedData.template) {
            currentTemplate = savedData.template;
            const templateSelect = document.getElementById('template-select');
            if (templateSelect) templateSelect.value = currentTemplate;
        }
        
    } catch (error) {
        console.error('Error loading saved data:', error);
    }
}

function collectResumeData() {
    return {
        name: getElementValue('name') || 'Your Name',
        title: getElementValue('title') || '',
        email: getElementValue('email') || '',
        phone: getElementValue('phone') || '',
        location: getElementValue('location') || '',
        linkedin: getElementValue('linkedin') || '',
        website: getElementValue('website') || '',
        github: getElementValue('github') || '',
        summary: getElementValue('summary-input') || '',
        experience: getExperienceData(),
        education: getEducationData(),
        projects: getProjectsData(),
        skills: getElementValue('skills-input') || '',
        template: currentTemplate
    };
}

// ===== EXPERIENCE SECTION =====
function initializeExperienceSection() {
    const container = document.getElementById('experience-container');
    const addBtn = document.getElementById('add-experience-btn');
    
    if (!container || !addBtn) return;
    
    addBtn.addEventListener('click', () => addExperienceEntry());
    
    if (experienceEntries.length === 0) {
        addExperienceEntry();
    }
}

function addExperienceEntry(data = null) {
    experienceCounter++;
    const entryId = `experience-${experienceCounter}`;
    
    const entryData = {
        company: data?.company || '',
        position: data?.position || '',
        location: data?.location || '',
        startDate: data?.startDate || '',
        endDate: data?.endDate || '',
        current: data?.current || false,
        description: data?.description || ''
    };
    
    experienceEntries.push({ id: entryId, ...entryData });
    
    const container = document.getElementById('experience-container');
    const entryHTML = generateExperienceEntryHTML(entryId, entryData, experienceEntries.length);
    
    container.insertAdjacentHTML('beforeend', entryHTML);
    addExperienceEventListeners(entryId);
    updatePreview();
    
    const companyInput = document.getElementById(`${entryId}-company`);
    if (companyInput) companyInput.focus();
}

function generateExperienceEntryHTML(entryId, data, index) {
    return `
        <div class="experience-entry" id="${entryId}">
            <div class="experience-header">
                <div class="experience-number">${index}</div>
                <h4 class="experience-title">${data.company || data.position || 'New Experience'}</h4>
                <button type="button" class="remove-experience-btn" onclick="removeExperienceEntry('${entryId}')">✕</button>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="${entryId}-company">Company *</label>
                    <input type="text" id="${entryId}-company" value="${data.company}" required>
                </div>
                <div class="form-group">
                    <label for="${entryId}-position">Position *</label>
                    <input type="text" id="${entryId}-position" value="${data.position}" required>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="${entryId}-location">Location</label>
                    <input type="text" id="${entryId}-location" value="${data.location}" placeholder="City, State">
                </div>
            </div>
            
            <div class="form-group">
                <label>Employment Period</label>
                <div class="date-range">
                    <div class="form-group">
                        <label for="${entryId}-start-date">Start Date</label>
                        <input type="month" id="${entryId}-start-date" value="${data.startDate}">
                    </div>
                    <div class="form-group">
                        <label for="${entryId}-end-date">End Date</label>
                        <input type="month" id="${entryId}-end-date" value="${data.endDate}" ${data.current ? 'disabled' : ''}>
                    </div>
                    <div class="current-position">
                        <input type="checkbox" id="${entryId}-current" ${data.current ? 'checked' : ''}>
                        <label for="${entryId}-current">Current Position</label>
                    </div>
                </div>
            </div>
            
            <div class="form-group ai-enhanced">
                <label for="${entryId}-description">Key Achievements & Responsibilities</label>
                <textarea id="${entryId}-description" rows="4" placeholder="• Led team of 5 developers to deliver projects 20% ahead of schedule
• Implemented new system that increased efficiency by 30%
• Managed $2M budget and reduced costs by 15%">${data.description}</textarea>
                <button type="button" class="btn-ai" onclick="getExperienceAISuggestion('${entryId}')">🤖 AI Suggest</button>
            </div>
        </div>
    `;
}

function addExperienceEventListeners(entryId) {
    const inputs = document.querySelectorAll(`#${entryId} input, #${entryId} textarea`);
    
    inputs.forEach(input => {
        input.addEventListener('input', function() {
            updateExperienceEntry(entryId);
            updateExperienceTitle(entryId);
            updatePreview();
            autoSave();
        });
    });
    
    const currentCheckbox = document.getElementById(`${entryId}-current`);
    const endDateInput = document.getElementById(`${entryId}-end-date`);
    
    if (currentCheckbox && endDateInput) {
        currentCheckbox.addEventListener('change', function() {
            endDateInput.disabled = this.checked;
            if (this.checked) endDateInput.value = '';
            updateExperienceEntry(entryId);
        });
    }
}

function updateExperienceEntry(entryId) {
    const entry = experienceEntries.find(e => e.id === entryId);
    if (!entry) return;
    
    entry.company = getElementValue(`${entryId}-company`);
    entry.position = getElementValue(`${entryId}-position`);
    entry.location = getElementValue(`${entryId}-location`);
    entry.startDate = getElementValue(`${entryId}-start-date`);
    entry.endDate = getElementValue(`${entryId}-end-date`);
    entry.current = document.getElementById(`${entryId}-current`)?.checked || false;
    entry.description = getElementValue(`${entryId}-description`);
}

function updateExperienceTitle(entryId) {
    const entry = experienceEntries.find(e => e.id === entryId);
    const titleElement = document.querySelector(`#${entryId} .experience-title`);
    
    if (entry && titleElement) {
        const title = entry.position && entry.company ? 
            `${entry.position} at ${entry.company}` : 
            entry.position || entry.company || 'New Experience';
        titleElement.textContent = title;
    }
}

function removeExperienceEntry(entryId) {
    if (experienceEntries.length <= 1) {
        showMessage('You must have at least one work experience entry.', 'warning');
        return;
    }
    
    if (confirm('Are you sure you want to remove this experience entry?')) {
        experienceEntries = experienceEntries.filter(e => e.id !== entryId);
        document.getElementById(entryId)?.remove();
        updateExperienceNumbering();
        updatePreview();
        autoSave();
        showMessage('Experience entry removed successfully!', 'success');
    }
}

function updateExperienceNumbering() {
    const container = document.getElementById('experience-container');
    const entries = container.querySelectorAll('.experience-entry');
    
    entries.forEach((entry, index) => {
        const numberElement = entry.querySelector('.experience-number');
        if (numberElement) numberElement.textContent = index + 1;
    });
}

function getExperienceData() {
    return experienceEntries.map(entry => ({
        company: entry.company || '',
        position: entry.position || '',
        location: entry.location || '',
        startDate: entry.startDate || '',
        endDate: entry.endDate || '',
        current: entry.current || false,
        description: entry.description || ''
    }));
}

function loadExperienceEntries(savedExperience) {
    experienceEntries = [];
    experienceCounter = 0;
    const container = document.getElementById('experience-container');
    if (container) container.innerHTML = '';
    
    if (Array.isArray(savedExperience) && savedExperience.length > 0) {
        savedExperience.forEach(exp => addExperienceEntry(exp));
    } else if (typeof savedExperience === 'string' && savedExperience.trim()) {
        addExperienceEntry({ description: savedExperience });
    } else {
        addExperienceEntry();
    }
}

// ===== EDUCATION SECTION =====
function initializeEducationSection() {
    const container = document.getElementById('education-container');
    const addBtn = document.getElementById('add-education-btn');
    
    if (!container || !addBtn) return;
    
    addBtn.addEventListener('click', () => addEducationEntry());
    
    if (educationEntries.length === 0) {
        addEducationEntry();
    }
}

function addEducationEntry(data = null) {
    educationCounter++;
    const entryId = `education-${educationCounter}`;
    
    const entryData = {
        degree: data?.degree || '',
        school: data?.school || '',
        location: data?.location || '',
        graduationDate: data?.graduationDate || '',
        gpa: data?.gpa || '',
        description: data?.description || ''
    };
    
    educationEntries.push({ id: entryId, ...entryData });
    
    const container = document.getElementById('education-container');
    const entryHTML = generateEducationEntryHTML(entryId, entryData, educationEntries.length);
    
    container.insertAdjacentHTML('beforeend', entryHTML);
    addEducationEventListeners(entryId);
    updatePreview();
    
    const degreeInput = document.getElementById(`${entryId}-degree`);
    if (degreeInput) degreeInput.focus();
}

function generateEducationEntryHTML(entryId, data, index) {
    return `
        <div class="education-entry" id="${entryId}">
            <div class="education-header">
                <div class="education-number">${index}</div>
                <h4 class="education-title">${data.degree || data.school || 'New Education'}</h4>
                <button type="button" class="remove-education-btn" onclick="removeEducationEntry('${entryId}')">✕</button>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="${entryId}-degree">Degree *</label>
                    <input type="text" id="${entryId}-degree" value="${data.degree}" placeholder="e.g., Bachelor of Science in Computer Science" required>
                </div>
                <div class="form-group">
                    <label for="${entryId}-school">School *</label>
                    <input type="text" id="${entryId}-school" value="${data.school}" placeholder="e.g., University of Technology" required>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="${entryId}-location">Location</label>
                    <input type="text" id="${entryId}-location" value="${data.location}" placeholder="City, State">
                </div>
                <div class="form-group">
                    <label for="${entryId}-graduation-date">Graduation Date</label>
                    <input type="month" id="${entryId}-graduation-date" value="${data.graduationDate}">
                </div>
            </div>
            
            <div class="form-group">
                <label for="${entryId}-gpa">GPA (Optional)</label>
                <div class="gpa-group">
                    <input type="number" id="${entryId}-gpa" value="${data.gpa}" placeholder="3.75" min="0" max="4" step="0.01">
                    <span class="gpa-note">Only include if 3.5+</span>
                </div>
            </div>
            
            <div class="form-group ai-enhanced">
                <label for="${entryId}-description">Relevant Coursework, Honors & Achievements</label>
                <textarea id="${entryId}-description" rows="3" placeholder="• Relevant coursework: Data Structures, Algorithms, Machine Learning
• Dean's List (Fall 2022, Spring 2023)
• Computer Science Club President">${data.description}</textarea>
                <button type="button" class="btn-ai" onclick="getEducationAISuggestion('${entryId}')">🤖 AI Suggest</button>
            </div>
        </div>
    `;
}

function addEducationEventListeners(entryId) {
    const inputs = document.querySelectorAll(`#${entryId} input, #${entryId} textarea`);
    
    inputs.forEach(input => {
        input.addEventListener('input', function() {
            updateEducationEntry(entryId);
            updateEducationTitle(entryId);
            updatePreview();
            autoSave();
        });
    });
}

function updateEducationEntry(entryId) {
    const entry = educationEntries.find(e => e.id === entryId);
    if (!entry) return;
    
    entry.degree = getElementValue(`${entryId}-degree`);
    entry.school = getElementValue(`${entryId}-school`);
    entry.location = getElementValue(`${entryId}-location`);
    entry.graduationDate = getElementValue(`${entryId}-graduation-date`);
    entry.gpa = getElementValue(`${entryId}-gpa`);
    entry.description = getElementValue(`${entryId}-description`);
}

function updateEducationTitle(entryId) {
    const entry = educationEntries.find(e => e.id === entryId);
    const titleElement = document.querySelector(`#${entryId} .education-title`);
    
    if (entry && titleElement) {
        const title = entry.degree && entry.school ? 
            `${entry.degree} - ${entry.school}` : 
            entry.degree || entry.school || 'New Education';
        titleElement.textContent = title;
    }
}

function removeEducationEntry(entryId) {
    if (educationEntries.length <= 1) {
        showMessage('You must have at least one education entry.', 'warning');
        return;
    }
    
    if (confirm('Are you sure you want to remove this education entry?')) {
        educationEntries = educationEntries.filter(e => e.id !== entryId);
        document.getElementById(entryId)?.remove();
        updateEducationNumbering();
        updatePreview();
        autoSave();
        showMessage('Education entry removed successfully!', 'success');
    }
}

function updateEducationNumbering() {
    const container = document.getElementById('education-container');
    const entries = container.querySelectorAll('.education-entry');
    
    entries.forEach((entry, index) => {
        const numberElement = entry.querySelector('.education-number');
        if (numberElement) numberElement.textContent = index + 1;
    });
}

function getEducationData() {
    return educationEntries.map(entry => ({
        degree: entry.degree || '',
        school: entry.school || '',
        location: entry.location || '',
        graduationDate: entry.graduationDate || '',
        gpa: entry.gpa || '',
        description: entry.description || ''
    }));
}

function loadEducationEntries(savedEducation) {
    educationEntries = [];
    educationCounter = 0;
    const container = document.getElementById('education-container');
    if (container) container.innerHTML = '';
    
    if (Array.isArray(savedEducation) && savedEducation.length > 0) {
        savedEducation.forEach(edu => addEducationEntry(edu));
    } else if (typeof savedEducation === 'string' && savedEducation.trim()) {
        addEducationEntry({ description: savedEducation });
    } else {
        addEducationEntry();
    }
}

// ===== PROJECTS SECTION =====
function initializeProjectsSection() {
    const container = document.getElementById('projects-container');
    const addBtn = document.getElementById('add-project-btn');
    
    if (!container || !addBtn) return;
    
    addBtn.addEventListener('click', () => addProjectEntry());
    
    if (projectEntries.length === 0) {
        addProjectEntry();
    }
}

function addProjectEntry(data = null) {
    projectCounter++;
    const entryId = `project-${projectCounter}`;
    
    const entryData = {
        name: data?.name || '',
        description: data?.description || '',
        technologies: data?.technologies || '',
        startDate: data?.startDate || '',
        endDate: data?.endDate || '',
        current: data?.current || false,
        githubUrl: data?.githubUrl || '',
        demoUrl: data?.demoUrl || ''
    };
    
    projectEntries.push({ id: entryId, ...entryData });
    
    const container = document.getElementById('projects-container');
    const entryHTML = generateProjectEntryHTML(entryId, entryData, projectEntries.length);
    
    container.insertAdjacentHTML('beforeend', entryHTML);
    addProjectEventListeners(entryId);
    updatePreview();
    
    const nameInput = document.getElementById(`${entryId}-name`);
    if (nameInput) nameInput.focus();
}

function generateProjectEntryHTML(entryId, data, index) {
    return `
        <div class="project-entry" id="${entryId}">
            <div class="project-header">
                <div class="project-number">${index}</div>
                <h4 class="project-title">${data.name || 'New Project'}</h4>
                <button type="button" class="remove-project-btn" onclick="removeProjectEntry('${entryId}')">✕</button>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="${entryId}-name">Project Name *</label>
                    <input type="text" id="${entryId}-name" value="${data.name}" required placeholder="e.g., E-commerce Web App">
                </div>
                <div class="form-group">
                    <label for="${entryId}-technologies">Technologies Used</label>
                    <input type="text" id="${entryId}-technologies" value="${data.technologies}" placeholder="React, Node.js, MongoDB, AWS" class="tech-stack-input">
                    <div class="tech-preview" id="${entryId}-tech-preview"></div>
                </div>
            </div>
            
            <div class="form-group">
                <label>Project Timeline</label>
                <div class="date-range">
                    <div class="form-group">
                        <label for="${entryId}-start-date">Start Date</label>
                        <input type="month" id="${entryId}-start-date" value="${data.startDate}">
                    </div>
                    <div class="form-group">
                        <label for="${entryId}-end-date">End Date</label>
                        <input type="month" id="${entryId}-end-date" value="${data.endDate}" ${data.current ? 'disabled' : ''}>
                    </div>
                    <div class="current-position">
                        <input type="checkbox" id="${entryId}-current" ${data.current ? 'checked' : ''}>
                        <label for="${entryId}-current">Ongoing Project</label>
                    </div>
                </div>
            </div>
            
            <div class="form-group">
                <label>Project Links (Optional)</label>
                <div class="project-links">
                    <div class="form-group">
                        <label for="${entryId}-github">GitHub URL</label>
                        <input type="url" id="${entryId}-github" value="${data.githubUrl}" placeholder="https://github.com/username/project">
                    </div>
                    <div class="form-group">
                        <label for="${entryId}-demo">Live Demo URL</label>
                        <input type="url" id="${entryId}-demo" value="${data.demoUrl}" placeholder="https://project-demo.com">
                    </div>
                </div>
            </div>
            
            <div class="form-group ai-enhanced">
                <label for="${entryId}-description">Project Description & Key Achievements</label>
                <textarea id="${entryId}-description" rows="4" placeholder="• Developed a full-stack e-commerce application serving 1000+ users
• Implemented secure payment processing reducing checkout time by 40%
• Built responsive UI with React and integrated REST APIs">${data.description}</textarea>
                <button type="button" class="btn-ai" onclick="getProjectAISuggestion('${entryId}')">🤖 AI Suggest</button>
            </div>
        </div>
    `;
}

function addProjectEventListeners(entryId) {
    const inputs = document.querySelectorAll(`#${entryId} input, #${entryId} textarea`);
    
    inputs.forEach(input => {
        input.addEventListener('input', function() {
            updateProjectEntry(entryId);
            updateProjectTitle(entryId);
            
            if (this.id.includes('technologies')) {
                updateTechPreview(entryId);
            }
            
            updatePreview();
            autoSave();
        });
    });
    
    const currentCheckbox = document.getElementById(`${entryId}-current`);
    const endDateInput = document.getElementById(`${entryId}-end-date`);
    
    if (currentCheckbox && endDateInput) {
        currentCheckbox.addEventListener('change', function() {
            endDateInput.disabled = this.checked;
            if (this.checked) endDateInput.value = '';
            updateProjectEntry(entryId);
        });
    }
    
    updateTechPreview(entryId);
}

function updateTechPreview(entryId) {
    const techInput = document.getElementById(`${entryId}-technologies`);
    const preview = document.getElementById(`${entryId}-tech-preview`);
    
    if (!techInput || !preview) return;
    
    const technologies = techInput.value.split(',').map(t => t.trim()).filter(t => t);
    preview.innerHTML = technologies.map(tech => 
        `<span class="tech-tag">${escapeHtml(tech)}</span>`
    ).join('');
}

function updateProjectEntry(entryId) {
    const entry = projectEntries.find(e => e.id === entryId);
    if (!entry) return;
    
    entry.name = getElementValue(`${entryId}-name`);
    entry.description = getElementValue(`${entryId}-description`);
    entry.technologies = getElementValue(`${entryId}-technologies`);
    entry.startDate = getElementValue(`${entryId}-start-date`);
    entry.endDate = getElementValue(`${entryId}-end-date`);
    entry.current = document.getElementById(`${entryId}-current`)?.checked || false;
    entry.githubUrl = getElementValue(`${entryId}-github`);
    entry.demoUrl = getElementValue(`${entryId}-demo`);
}

function updateProjectTitle(entryId) {
    const entry = projectEntries.find(e => e.id === entryId);
    const titleElement = document.querySelector(`#${entryId} .project-title`);
    
    if (entry && titleElement) {
        titleElement.textContent = entry.name || 'New Project';
    }
}

function removeProjectEntry(entryId) {
    if (projectEntries.length <= 1) {
        showMessage('You must have at least one project entry.', 'warning');
        return;
    }
    
    if (confirm('Are you sure you want to remove this project entry?')) {
        projectEntries = projectEntries.filter(e => e.id !== entryId);
        document.getElementById(entryId)?.remove();
        updateProjectNumbering();
        updatePreview();
        autoSave();
        showMessage('Project entry removed successfully!', 'success');
    }
}

function updateProjectNumbering() {
    const container = document.getElementById('projects-container');
    const entries = container.querySelectorAll('.project-entry');
    
    entries.forEach((entry, index) => {
        const numberElement = entry.querySelector('.project-number');
        if (numberElement) numberElement.textContent = index + 1;
    });
}

function getProjectsData() {
    return projectEntries.map(entry => ({
        name: entry.name || '',
        description: entry.description || '',
        technologies: entry.technologies || '',
        startDate: entry.startDate || '',
        endDate: entry.endDate || '',
        current: entry.current || false,
        githubUrl: entry.githubUrl || '',
        demoUrl: entry.demoUrl || ''
    }));
}

function loadProjectEntries(savedProjects) {
    projectEntries = [];
    projectCounter = 0;
    const container = document.getElementById('projects-container');
    if (container) container.innerHTML = '';
    
    if (Array.isArray(savedProjects) && savedProjects.length > 0) {
        savedProjects.forEach(project => addProjectEntry(project));
    } else {
        addProjectEntry();
    }
}

// ===== ADVANCED FEATURES =====
function initializeAdvancedFeatures() {
    console.log('🎯 Initializing advanced features...');
    updateProgressIndicator();
    setTimeout(calculateATSScore, 1000);
    initializeSmartSuggestions();
}

function updateProgressIndicator() {
    progressData.personal = calculatePersonalInfoProgress();
    progressData.summary = getElementValue('summary-input').length > 50 ? 100 : 0;
    progressData.experience = experienceEntries.length > 0 && experienceEntries[0].company ? 100 : 0;
    progressData.education = educationEntries.length > 0 && educationEntries[0].degree ? 100 : 0;
    progressData.projects = projectEntries.length > 0 && projectEntries[0].name ? 100 : 0;
    progressData.skills = getElementValue('skills-input').length > 20 ? 100 : 0;
    
    const totalProgress = Object.values(progressData).reduce((a, b) => a + b, 0) / 6;
    
    const progressFill = document.querySelector('.progress-fill');
    const progressPercentage = document.querySelector('.progress-percentage');
    
    if (progressFill && progressPercentage) {
        progressFill.style.width = `${totalProgress}%`;
        progressPercentage.textContent = `${Math.round(totalProgress)}%`;
    }
    
    updateSectionIndicators();
}

function calculatePersonalInfoProgress() {
    const fields = ['name', 'email', 'title', 'location'];
    let completedFields = 0;
    
    fields.forEach(fieldId => {
        if (getElementValue(fieldId).trim()) {
            completedFields++;
        }
    });
    
    return (completedFields / fields.length) * 100;
}

function updateSectionIndicators() {
    const sections = ['personal', 'summary', 'experience', 'education', 'projects', 'skills'];
    
    sections.forEach(section => {
        const indicator = document.querySelector(`.progress-icon[data-section="${section}"]`);
        if (indicator) {
            if (progressData[section] >= 80) {
                indicator.className = 'progress-icon complete';
                indicator.textContent = '✓';
            } else {
                indicator.className = 'progress-icon incomplete';
                indicator.textContent = Math.round(progressData[section] / 20) || '○';
            }
        }
    });
}

function calculateATSScore() {
    let score = 0;
    let suggestions = [];
    
    // Check required sections (40 points)
    const requiredSections = {
        name: getElementValue('name').trim(),
        email: getElementValue('email').trim(),
        summary: getElementValue('summary-input').trim(),
        experience: experienceEntries.length > 0,
        skills: getElementValue('skills-input').trim()
    };
    
    Object.entries(requiredSections).forEach(([key, value]) => {
        if (value) score += 8;
        else suggestions.push(`Add ${key} section for better ATS compatibility`);
    });
    
    // Check contact information (20 points)
    const contactFields = ['phone', 'location', 'linkedin'];
    contactFields.forEach(field => {
        if (getElementValue(field).trim()) {
            score += 6.67;
        }
    });
    
    // Check keyword density (20 points)
    const jobTitle = getElementValue('title').toLowerCase();
    const allText = getAllResumeText().toLowerCase();
    
    if (jobTitle) {
        const titleWords = jobTitle.split(' ');
        let keywordMatches = 0;
        titleWords.forEach(word => {
            if (allText.includes(word) && word.length > 2) {
                keywordMatches++;
            }
        });
        score += Math.min(keywordMatches * 4, 20);
    }
    
    // Check formatting (20 points)
    if (experienceEntries.some(exp => exp.startDate)) score += 5;
    if (experienceEntries.some(exp => exp.description && exp.description.includes('•'))) score += 5;
    if (educationEntries.length > 0) score += 5;
    if (projectEntries.length > 0) score += 5;
    
    atsScore = Math.min(Math.round(score), 100);
    updateATSScoreDisplay(suggestions);
}

function getAllResumeText() {
    let text = getElementValue('summary-input') + ' ' + getElementValue('skills-input');
    
    experienceEntries.forEach(exp => text += ' ' + (exp.description || ''));
    educationEntries.forEach(edu => text += ' ' + (edu.description || ''));
    projectEntries.forEach(project => text += ' ' + (project.description || ''));
    
    return text;
}

function updateATSScoreDisplay(suggestions) {
    const scoreElement = document.getElementById('ats-score');
    const previewElement = document.getElementById('ats-score-preview');
    
    if (scoreElement) {
        scoreElement.textContent = atsScore;
    }
    
    if (previewElement && atsScore > 0) {
        previewElement.style.display = 'block';
        
        const keywordsStatus = document.getElementById('keywords-status');
        const sectionsStatus = document.getElementById('sections-status');
        const formatStatus = document.getElementById('format-status');
        
        if (keywordsStatus) keywordsStatus.textContent = atsScore >= 70 ? 'Good' : 'Needs Work';
        if (sectionsStatus) sectionsStatus.textContent = progressData.experience && progressData.education ? 'Complete' : 'Missing';
        if (formatStatus) formatStatus.textContent = experienceEntries.some(exp => exp.startDate) ? 'Good' : 'Improve';
        
        const suggestionsElement = document.getElementById('score-suggestions');
        if (suggestionsElement) {
            if (suggestions.length > 0) {
                suggestionsElement.innerHTML = `
                    <strong>Improvement Suggestions:</strong>
                    <ul>${suggestions.map(s => `<li>${s}</li>`).join('')}</ul>
                `;
            } else {
                suggestionsElement.innerHTML = '<strong>Great job!</strong> Your resume has excellent ATS compatibility.';
            }
        }
    }
}

function initializeSmartSuggestions() {
    setTimeout(checkForSmartSuggestions, 2000);
}

function checkForSmartSuggestions() {
    const suggestions = [];
    
    if (!getElementValue('linkedin').trim()) {
        suggestions.push({
            type: 'linkedin',
            text: 'Add your LinkedIn profile to increase professional credibility',
            action: 'Focus LinkedIn field'
        });
    }
    
    const jobTitle = getElementValue('title').toLowerCase();
    if ((jobTitle.includes('engineer') || jobTitle.includes('developer') || jobTitle.includes('programmer')) 
        && projectEntries.length === 0) {
        suggestions.push({
            type: 'projects',
            text: 'Technical roles benefit from showcasing relevant projects',
            action: 'Add project'
        });
    }
    
    const hasNumbers = experienceEntries.some(exp => 
        exp.description && /\d+%|\$\d+|\d+\+/.test(exp.description)
    );
    
    if (!hasNumbers && experienceEntries.length > 0) {
        suggestions.push({
            type: 'metrics',
            text: 'Add specific numbers and metrics to your achievements for better impact',
            action: 'Review experience'
        });
    }
    
    displaySmartSuggestions(suggestions);
}

function displaySmartSuggestions(suggestions) {
    if (suggestions.length === 0) return;
    
    const suggestionsPanel = document.querySelector('.smart-suggestions');
    if (!suggestionsPanel) return;
    
    const suggestionsHTML = suggestions.map(suggestion => `
        <div class="suggestion-item">
            <div class="suggestion-text">${suggestion.text}</div>
            <button class="suggestion-action" onclick="handleSuggestionAction('${suggestion.type}')">${suggestion.action}</button>
        </div>
    `).join('');
    
    suggestionsPanel.innerHTML = `
        <div class="suggestions-header">
            <span>🎯</span>
            <h4>Smart Suggestions</h4>
        </div>
        ${suggestionsHTML}
    `;
    
    suggestionsPanel.classList.add('show');
}

function handleSuggestionAction(type) {
    switch (type) {
        case 'linkedin':
            document.getElementById('linkedin')?.focus();
            break;
        case 'projects':
            addProjectEntry();
            break;
        case 'metrics':
            if (experienceEntries.length > 0) {
                document.getElementById(`${experienceEntries[0].id}-description`)?.focus();
            }
            break;
    }
}

// ===== PREVIEW AND TEMPLATE GENERATION =====
function updatePreview() {
    try {
        const previewElement = document.getElementById('resume-preview');
        if (!previewElement) return;
        
        previewElement.className = `resume-preview ${currentTemplate}-template`;
        
        resumeData = collectResumeData();
        const html = generateTemplateHTML(resumeData, currentTemplate);
        previewElement.innerHTML = html;
        
        updateProgressIndicator();
        calculateATSScore();
        
    } catch (error) {
        console.error('Preview update error:', error);
        showMessage('Error updating preview', 'error');
    }
}

// Add this function BEFORE generateTemplateHTML
function shouldRenderSection(sectionData, sectionType) {
    if (sectionType === 'projects') {
        return sectionData && sectionData.length > 0 && sectionData.some(p => p.name && p.name.trim());
    }
    if (sectionType === 'education') {
        return sectionData && sectionData.length > 0 && sectionData.some(e => e.degree && e.degree.trim());
    }
    if (sectionType === 'experience') {
        return sectionData && sectionData.length > 0 && sectionData.some(e => e.company && e.company.trim());
    }
    // For string-based sections like summary and skills
    return sectionData && sectionData.trim().length > 0;
}

// Add this helper function BEFORE generateTemplateHTML
function shouldRenderSection(sectionData, sectionType) {
    if (sectionType === 'projects') {
        return sectionData && sectionData.length > 0 && sectionData.some(p => p.name && p.name.trim());
    }
    if (sectionType === 'education') {
        return sectionData && sectionData.length > 0 && sectionData.some(e => e.degree && e.degree.trim());
    }
    if (sectionType === 'experience') {
        return sectionData && sectionData.length > 0 && sectionData.some(e => e.company && e.company.trim());
    }
    // For string-based sections like summary and skills
    return sectionData && sectionData.trim().length > 0;
}

// COMPLETE generateTemplateHTML function with optimal section order
function generateTemplateHTML(data, template) {
    try {
        console.log('Generating HTML for template:', template);
        
        // Base header HTML with enhanced contact info
        let html = `
            <div class="resume-header ${template}-header">
                <h1>${escapeHtml(data.name)}</h1>
                ${data.title ? `<div class="target-role">${escapeHtml(data.title)}</div>` : ''}
                <div class="contact-info">
                    ${data.email ? `<span>📧 ${escapeHtml(data.email)}</span>` : ''}
                    ${data.phone ? `<span>📞 ${escapeHtml(data.phone)}</span>` : ''}
                    ${data.location ? `<span>📍 ${escapeHtml(data.location)}</span>` : ''}
                    ${data.linkedin ? `<span>💼 <a href="${escapeHtml(data.linkedin)}" target="_blank">LinkedIn</a></span>` : ''}
                    ${data.website ? `<span>🌐 <a href="${escapeHtml(data.website)}" target="_blank">Portfolio</a></span>` : ''}
                    ${data.github ? `<span>💻 <a href="${escapeHtml(data.github)}" target="_blank">GitHub</a></span>` : ''}
                </div>
            </div>
        `;
        
        // 1. Professional Summary
        if (shouldRenderSection(data.summary, 'summary')) {
            html += `
                <div class="resume-section ${template}-section">
                    <h3>Professional Summary</h3>
                    <p>${escapeHtml(data.summary).replace(/\n/g, '<br>')}</p>
                </div>
            `;
        }
        
        // 2. Education Section - MOVED UP for students/new grads
        if (shouldRenderSection(data.education, 'education')) {
            html += `<div class="resume-section ${template}-section">
                <h3>Education</h3>`;
            
            data.education.forEach(edu => {
                if (edu.degree || edu.school) {
                    html += `<div class="education-entry">`;
                    
                    // Degree and School
                    if (edu.degree || edu.school) {
                        html += `<div class="edu-header">
                            <h4>${escapeHtml(edu.degree || 'Degree')}</h4>
                            <span class="school">${escapeHtml(edu.school || 'School')}</span>
                        </div>`;
                    }
                    
                    // Date, Location, GPA
                    let details = [];
                    if (edu.graduationDate) {
                        const gradDate = new Date(edu.graduationDate + '-01');
                        details.push(gradDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
                    }
                    if (edu.location) details.push(edu.location);
                    if (edu.gpa && parseFloat(edu.gpa) >= 3.5) details.push(`GPA: ${edu.gpa}`);
                    
                    if (details.length > 0) {
                        html += `<div class="edu-dates">${details.join(' | ')}</div>`;
                    }
                    
                    // Description
                    if (edu.description) {
                        html += `<div class="edu-description">${escapeHtml(edu.description).replace(/\n/g, '<br>')}</div>`;
                    }
                    
                    html += `</div>`;
                }
            });
            
            html += `</div>`;
        }
        
        // 3. Work Experience Section - Now after Education
        if (shouldRenderSection(data.experience, 'experience')) {
            html += `<div class="resume-section ${template}-section">
                <h3>Work Experience</h3>`;
            
            data.experience.forEach(exp => {
                if (exp.company || exp.position) {
                    html += `<div class="experience-entry">`;
                    
                    // Position and Company
                    if (exp.position || exp.company) {
                        html += `<div class="exp-header">
                            <h4>${escapeHtml(exp.position || 'Position')}</h4>
                            <span class="company">${escapeHtml(exp.company || 'Company')}</span>
                        </div>`;
                    }
                    
                    // Dates and Location
                    let dateLocation = [];
                    if (exp.startDate || exp.endDate || exp.current) {
                        let dateRange = '';
                        if (exp.startDate) {
                            const startDate = new Date(exp.startDate + '-01');
                            dateRange += startDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                        }
                        if (exp.current) {
                            dateRange += ' - Present';
                        } else if (exp.endDate) {
                            const endDate = new Date(exp.endDate + '-01');
                            dateRange += ' - ' + endDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                        }
                        if (dateRange) dateLocation.push(dateRange);
                    }
                    if (exp.location) dateLocation.push(exp.location);
                    
                    if (dateLocation.length > 0) {
                        html += `<div class="exp-dates">${dateLocation.join(' | ')}</div>`;
                    }
                    
                    // Description
                    if (exp.description) {
                        html += `<div class="exp-description">${escapeHtml(exp.description).replace(/\n/g, '<br>')}</div>`;
                    }
                    
                    html += `</div>`;
                }
            });
            
            html += `</div>`;
        }
        
        // 4. Projects Section - Only renders if has meaningful content
        if (shouldRenderSection(data.projects, 'projects')) {
            html += `<div class="resume-section ${template}-section">
                <h3>Projects</h3>`;
            
            data.projects.forEach(project => {
                if (project.name) {
                    html += `<div class="project-entry">`;
                    
                    // Project Name
                    html += `<div class="project-header">
                        <h4>${escapeHtml(project.name)}</h4>
                    </div>`;
                    
                    // Technologies
                    if (project.technologies) {
                        const techArray = project.technologies.split(',').map(t => t.trim()).filter(t => t);
                        if (techArray.length > 0) {
                            html += `<div class="project-tech">
                                <strong>Technologies:</strong> ${techArray.map(tech => `<span class="tech-tag">${escapeHtml(tech)}</span>`).join(' ')}
                            </div>`;
                        }
                    }
                    
                    // Dates
                    if (project.startDate || project.endDate || project.current) {
                        let dateRange = '';
                        if (project.startDate) {
                            const startDate = new Date(project.startDate + '-01');
                            dateRange += startDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                        }
                        if (project.current) {
                            dateRange += ' - Present';
                        } else if (project.endDate) {
                            const endDate = new Date(project.endDate + '-01');
                            dateRange += ' - ' + endDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                        }
                        if (dateRange) {
                            html += `<div class="project-dates">${dateRange}</div>`;
                        }
                    }
                    
                    // Description
                    if (project.description) {
                        html += `<div class="project-description">${escapeHtml(project.description).replace(/\n/g, '<br>')}</div>`;
                    }
                    
                    // Links
                    let links = [];
                    if (project.githubUrl) links.push(`<a href="${escapeHtml(project.githubUrl)}" target="_blank">GitHub</a>`);
                    if (project.demoUrl) links.push(`<a href="${escapeHtml(project.demoUrl)}" target="_blank">Live Demo</a>`);
                    if (links.length > 0) {
                        html += `<div class="project-links">${links.join(' | ')}</div>`;
                    }
                    
                    html += `</div>`;
                }
            });
            
            html += `</div>`;
        }
        
        // 5. Skills Section - Last as supporting evidence
        if (shouldRenderSection(data.skills, 'skills')) {
            const skillsArray = data.skills.split(',').map(s => s.trim()).filter(s => s);
            if (skillsArray.length > 0) {
                html += `
                    <div class="resume-section ${template}-section">
                        <h3>Skills</h3>
                        <div class="skills-list ${template}-skills">
                            ${skillsArray.map(skill => `<span class="skill-tag ${template}-skill">${escapeHtml(skill)}</span>`).join('')}
                        </div>
                    </div>
                `;
            }
        }
        
        console.log('Generated HTML length:', html.length);
        return html;
        
    } catch (error) {
        console.error('Error generating template HTML:', error);
        return '<p style="color: red; text-align: center; margin-top: 2rem;">Error generating preview. Please check the console for details.</p>';
    }
}


// ===== AI SUGGESTIONS =====
async function getAISuggestion(section) {
    if (isProcessing) return;
    
    const textarea = document.getElementById(section + '-input');
    const btn = textarea?.nextElementSibling;
    
    if (!textarea || !btn) {
        showMessage(`Error: Could not find form elements for ${section}`, 'error');
        return;
    }
    
    const content = textarea.value.trim();
    if (!content) {
        showMessage('Please enter some content before requesting AI suggestions.', 'warning');
        return;
    }
    
    if (content.length > 2000) {
        showMessage('Content too long. Please limit to 2000 characters.', 'error');
        return;
    }
    
    try {
        isProcessing = true;
        textarea.disabled = true;
        btn.disabled = true;
        btn.innerHTML = '🤖 Thinking...';
        
        const jobTitle = getElementValue('title');
        
        const response = await fetch('/ai_suggest', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({ 
                section: section, 
                content: content,
                job_title: jobTitle
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || `Server error: ${response.status}`);
        }
        
        if (data.suggestion) {
            let suggestion = data.suggestion;
            
            if (section === 'skills') {
                suggestion = cleanupSkillsSuggestion(suggestion);
            }
            
            textarea.value = suggestion;
            updatePreview();
            showMessage('AI suggestion applied successfully!', 'success');
        }
        
    } catch (error) {
        console.error('AI suggestion error:', error);
        showMessage(`Error: ${error.message}`, 'error');
    } finally {
        isProcessing = false;
        textarea.disabled = false;
        btn.disabled = false;
        btn.innerHTML = '🤖 AI Suggest';
    }
}

async function getExperienceAISuggestion(entryId) {
    const entry = experienceEntries.find(e => e.id === entryId);
    if (!entry) return;
    
    const textarea = document.getElementById(`${entryId}-description`);
    const content = textarea.value.trim();
    
    if (!content) {
        showMessage('Please enter some job responsibilities before requesting AI suggestions.', 'warning');
        return;
    }
    
    const context = `Position: ${entry.position || 'Professional Role'}\nCompany: ${entry.company || 'Company'}\nResponsibilities: ${content}`;
    
    try {
        isProcessing = true;
        textarea.disabled = true;
        
        showMessage('Getting AI suggestions for your experience...', 'info');
        
        const jobTitle = getElementValue('title') || entry.position || '';
        
        const response = await fetch('/ai_suggest', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({ 
                section: 'experience', 
                content: context,
                job_title: jobTitle
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || `Server error: ${response.status}`);
        }
        
        if (data.suggestion) {
            textarea.value = data.suggestion;
            updateExperienceEntry(entryId);
            updatePreview();
            showMessage('AI suggestions applied successfully!', 'success');
        }
        
    } catch (error) {
        console.error('AI suggestion error:', error);
        showMessage(`Error: ${error.message}`, 'error');
    } finally {
        isProcessing = false;
        textarea.disabled = false;
    }
}

async function getEducationAISuggestion(entryId) {
    const entry = educationEntries.find(e => e.id === entryId);
    if (!entry) return;
    
    const textarea = document.getElementById(`${entryId}-description`);
    const content = textarea.value.trim();
    
    if (!content) {
        showMessage('Please enter some coursework or achievements before requesting AI suggestions.', 'warning');
        return;
    }
    
    const context = `Degree: ${entry.degree || 'Degree'}\nSchool: ${entry.school || 'School'}\nCoursework/Achievements: ${content}`;
    
    try {
        isProcessing = true;
        textarea.disabled = true;
        
        showMessage('Getting AI suggestions for your education...', 'info');
        
        const response = await fetch('/ai_suggest', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({ 
                section: 'education', 
                content: context,
                job_title: getElementValue('title')
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || `Server error: ${response.status}`);
        }
        
        if (data.suggestion) {
            textarea.value = data.suggestion;
            updateEducationEntry(entryId);
            updatePreview();
            showMessage('AI suggestions applied successfully!', 'success');
        }
        
    } catch (error) {
        console.error('AI suggestion error:', error);
        showMessage(`Error: ${error.message}`, 'error');
    } finally {
        isProcessing = false;
        textarea.disabled = false;
    }
}

async function getProjectAISuggestion(entryId) {
    const entry = projectEntries.find(e => e.id === entryId);
    if (!entry) return;
    
    const textarea = document.getElementById(`${entryId}-description`);
    const content = textarea.value.trim();
    
    if (!content) {
        showMessage('Please enter some project details before requesting AI suggestions.', 'warning');
        return;
    }
    
    const context = `Project: ${entry.name || 'Project'}\nTechnologies: ${entry.technologies || 'Various Technologies'}\nDescription: ${content}`;
    
    try {
        isProcessing = true;
        textarea.disabled = true;
        
        showMessage('Getting AI suggestions for your project...', 'info');
        
        const response = await fetch('/ai_suggest', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({ 
                section: 'projects', 
                content: context,
                job_title: getElementValue('title')
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || `Server error: ${response.status}`);
        }
        
        if (data.suggestion) {
            textarea.value = data.suggestion;
            updateProjectEntry(entryId);
            updatePreview();
            showMessage('AI suggestions applied successfully!', 'success');
        }
        
    } catch (error) {
        console.error('AI suggestion error:', error);
        showMessage(`Error: ${error.message}`, 'error');
    } finally {
        isProcessing = false;
        textarea.disabled = false;
    }
}

function cleanupSkillsSuggestion(suggestion) {
    let cleaned = suggestion
        .replace(/\*\*[^*]+\*\*:?\s*/g, '')
        .replace(/^\s*[-•]\s*/gm, '')
        .replace(/\n+/g, '\n')
        .trim();
    
    const lines = cleaned.split('\n').filter(line => line.trim());
    return lines.join(', ');
}

// ===== SAVE & EXPORT =====
async function saveResume() {
    try {
        showMessage('Saving resume...', 'info');
        
        const response = await fetch('/builder', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify(resumeData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage('Resume saved successfully!', 'success');
        } else {
            throw new Error(data.message || 'Failed to save resume');
        }
        
    } catch (error) {
        console.error('Save error:', error);
        showMessage(`Error saving resume: ${error.message}`, 'error');
    }
}

async function exportToPDF() {
    try {
        updatePreview();
        
        if (!resumeData.name || resumeData.name === 'Your Name' || !resumeData.name.trim()) {
            showMessage('Please fill in your name before exporting', 'warning');
            return;
        }
        
        showMessage('Generating PDF...', 'info');
        
        const response = await fetch('/export_pdf', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify(resumeData)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${resumeData.name.replace(/[^a-zA-Z0-9]/g, '_')}_Resume_${currentTemplate}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        showMessage('PDF downloaded successfully!', 'success');
        
    } catch (error) {
        console.error('PDF export error:', error);
        showMessage(`Error generating PDF: ${error.message}`, 'error');
    }
}

// ===== UTILITY FUNCTIONS =====
function clearAllContent() {
    if (confirm('Are you sure you want to clear all resume content? This action cannot be undone.')) {
        const fields = ['name', 'title', 'email', 'phone', 'location', 'linkedin', 'website', 'github', 'summary-input', 'skills-input'];
        fields.forEach(fieldId => {
            const element = document.getElementById(fieldId);
            if (element) element.value = '';
        });
        
        const templateSelect = document.getElementById('template-select');
        if (templateSelect) {
            templateSelect.value = 'classic';
            currentTemplate = 'classic';
        }
        
        // Clear dynamic sections
        experienceEntries = [];
        educationEntries = [];
        projectEntries = [];
        experienceCounter = 0;
        educationCounter = 0;
        projectCounter = 0;
        
        ['experience-container', 'education-container', 'projects-container'].forEach(containerId => {
            const container = document.getElementById(containerId);
            if (container) container.innerHTML = '';
        });
        
        // Re-initialize with empty entries
        addExperienceEntry();
        addEducationEntry();
        addProjectEntry();
        
        clearSessionData();
        updatePreview();
        showMessage('All content cleared successfully!', 'success');
    }
}

async function clearSessionData() {
    try {
        await fetch('/clear_session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
    } catch (error) {
        console.error('Error clearing session data:', error);
    }
}

function getElementValue(elementId) {
    const element = document.getElementById(elementId);
    return element ? element.value : '';
}

function setElementValue(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) element.value = value;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showMessage(message, type = 'info') {
    const existingMessages = document.querySelectorAll('.status-message');
    existingMessages.forEach(msg => msg.remove());
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `status-message ${type}`;
    messageDiv.textContent = message;
    
    const form = document.getElementById('resume-form');
    if (form) {
        form.insertBefore(messageDiv, form.firstChild);
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 5000);
    }
}

function validateForm() {
    const requiredFields = ['name', 'email'];
    let isValid = true;
    
    requiredFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field && !field.value.trim()) {
            field.style.borderColor = 'var(--error)';
            isValid = false;
        } else if (field) {
            field.style.borderColor = 'var(--border)';
        }
    });
    
    const email = document.getElementById('email');
    if (email && email.value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.value)) {
            email.style.borderColor = 'var(--error)';
            showMessage('Please enter a valid email address', 'error');
            isValid = false;
        }
    }
    
    return isValid;
}

function autoSave() {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => {
        if (resumeData.name && resumeData.name !== 'Your Name') {
            saveResume();
        }
    }, 3000);
}

// ===== GLOBAL FUNCTIONS =====
window.addExperienceEntry = addExperienceEntry;
window.removeExperienceEntry = removeExperienceEntry;
window.getExperienceAISuggestion = getExperienceAISuggestion;
window.addEducationEntry = addEducationEntry;
window.removeEducationEntry = removeEducationEntry;
window.getEducationAISuggestion = getEducationAISuggestion;
window.addProjectEntry = addProjectEntry;
window.removeProjectEntry = removeProjectEntry;
window.getProjectAISuggestion = getProjectAISuggestion;
window.getAISuggestion = getAISuggestion;
window.updatePreview = updatePreview;
window.saveResume = saveResume;
window.exportToPDF = exportToPDF;
window.clearAllContent = clearAllContent;
window.handleSuggestionAction = handleSuggestionAction;
