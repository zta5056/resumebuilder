// Global variables
let isProcessing = false;
let resumeData = {};
let currentTemplate = 'classic';

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing live preview...');
    
    // Initialize template selector
    const templateSelect = document.getElementById('template-select');
    if (templateSelect) {
        currentTemplate = templateSelect.value;
        console.log('Initial template:', currentTemplate);
        
        // Add template change event listener
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
    
    // Initialize all input event listeners for live preview
    const inputs = document.querySelectorAll('input, textarea');
    console.log('Found', inputs.length, 'input elements');
    
    inputs.forEach(input => {
        input.addEventListener('input', function() {
            console.log('Input changed:', this.id, '- Value:', this.value.substring(0, 50) + '...');
            updatePreview();
            autoSave();
        });
        
        // Clear error styling on focus
        input.addEventListener('focus', function() {
            this.style.borderColor = 'var(--primary)';
        });
    });
    
    // Initialize buttons
    const exportBtn = document.getElementById('export-pdf-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportToPDF);
    }
    
    const saveBtn = document.getElementById('save-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', function() {
            if (validateForm()) {
                saveResume();
            }
        });
    }
    
    // Initialize dynamic sections
    initializeExperienceSection();
    initializeEducationSection();
    
    // Initialize clear button
    const clearBtn = document.getElementById('clear-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearAllContent);
    }
    
    // Load saved data if available
    loadSavedData();
    
    // Initial preview update with delay to ensure DOM is ready
    setTimeout(() => {
        console.log('Running initial preview update...');
        updatePreview();
    }, 200);
});

// Load saved resume data from server
// Updated loadSavedData function
async function loadSavedData() {
    try {
        const response = await fetch('/get_resume_data');
        const savedData = await response.json();
        
        if (savedData && Object.keys(savedData).length > 0) {
            console.log('Loading saved data:', savedData);
            
            // Populate form fields
            if (savedData.personal_info) {
                const personalInfo = savedData.personal_info;
                if (personalInfo.name && document.getElementById('name')) {
                    document.getElementById('name').value = personalInfo.name;
                }
                if (personalInfo.title && document.getElementById('title')) {
                    document.getElementById('title').value = personalInfo.title;
                }
                if (personalInfo.email && document.getElementById('email')) {
                    document.getElementById('email').value = personalInfo.email;
                }
                if (personalInfo.phone && document.getElementById('phone')) {
                    document.getElementById('phone').value = personalInfo.phone;
                }
                if (personalInfo.location && document.getElementById('location')) {
                    document.getElementById('location').value = personalInfo.location;
                }
            }
            
            if (savedData.summary && document.getElementById('summary-input')) {
                document.getElementById('summary-input').value = savedData.summary;
            }
            
            // Load dynamic sections
            if (savedData.experience) {
                loadExperienceEntries(savedData.experience);
            }
            
            if (savedData.education) {
                loadEducationEntries(savedData.education);
            }
            
            if (savedData.skills && document.getElementById('skills-input')) {
                document.getElementById('skills-input').value = savedData.skills;
            }
            
            // Set template
            if (savedData.template) {
                currentTemplate = savedData.template;
                const templateSelect = document.getElementById('template-select');
                if (templateSelect) {
                    templateSelect.value = currentTemplate;
                }
            }
            
            // Update preview with loaded data
            setTimeout(updatePreview, 100);
        }
    } catch (error) {
        console.error('Error loading saved data:', error);
    }
}

// Clear all form content
function clearAllContent() {
    if (confirm('Are you sure you want to clear all resume content? This action cannot be undone.')) {
        // Clear all form fields
        if (document.getElementById('name')) document.getElementById('name').value = '';
        if (document.getElementById('title')) document.getElementById('title').value = '';
        if (document.getElementById('email')) document.getElementById('email').value = '';
        if (document.getElementById('phone')) document.getElementById('phone').value = '';
        if (document.getElementById('location')) document.getElementById('location').value = '';
        if (document.getElementById('summary-input')) document.getElementById('summary-input').value = '';
        if (document.getElementById('experience-input')) document.getElementById('experience-input').value = '';
        if (document.getElementById('education-input')) document.getElementById('education-input').value = '';
        if (document.getElementById('skills-input')) document.getElementById('skills-input').value = '';
        
        // Reset template to classic
        const templateSelect = document.getElementById('template-select');
        if (templateSelect) {
            templateSelect.value = 'classic';
            currentTemplate = 'classic';
        }
        
        // Clear session data
        clearSessionData();
        
        // Update preview
        updatePreview();
        
        showMessage('All content cleared successfully!', 'success');
    }
}

// Clear session data on server
async function clearSessionData() {
    try {
        const response = await fetch('/clear_session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        
        if (!response.ok) {
            console.error('Failed to clear session data');
        }
    } catch (error) {
        console.error('Error clearing session data:', error);
    }
}

// Enhanced AI suggestion function with skills cleanup
async function getAISuggestion(section) {
    if (isProcessing) {
        console.log('Already processing, skipping...');
        return;
    }
    
    const textarea = document.getElementById(section + '-input');
    const btn = textarea?.nextElementSibling;
    
    if (!textarea || !btn) {
        console.error(`Elements not found for section: ${section}`);
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
        
        const jobTitle = document.getElementById('title')?.value || '';
        
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
            
            // Special processing for skills section
            if (section === 'skills') {
                suggestion = cleanupSkillsSuggestion(suggestion);
            }
            
            textarea.value = suggestion;
            updatePreview();
            showMessage('AI suggestion applied successfully!', 'success');
        } else {
            throw new Error('No suggestion received from AI');
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

// Clean up skills suggestion to comma-separated format
function cleanupSkillsSuggestion(suggestion) {
    // Remove markdown headers and bullets
    let cleaned = suggestion
        .replace(/\*\*[^*]+\*\*:?\s*/g, '') // Remove **headers**
        .replace(/^\s*[-•]\s*/gm, '') // Remove bullet points
        .replace(/\n+/g, '\n') // Normalize line breaks
        .trim();
    
    // Split into lines and filter out empty ones
    const lines = cleaned.split('\n').filter(line => line.trim());
    
    // Join with commas
    return lines.join(', ');
}


// Updated updatePreview function
function updatePreview() {
    try {
        console.log('Updating preview with template:', currentTemplate);
        
        const previewElement = document.getElementById('resume-preview');
        if (!previewElement) {
            console.error('Preview element not found');
            return;
        }
        
        // Update preview class with current template
        previewElement.className = `resume-preview ${currentTemplate}-template`;
        
        // Collect all form data including dynamic sections
        resumeData = {
            name: getElementValue('name') || 'Your Name',
            title: getElementValue('title') || '',
            email: getElementValue('email') || '',
            phone: getElementValue('phone') || '',
            location: getElementValue('location') || '',
            summary: getElementValue('summary-input') || '',
            experience: getExperienceData(), // Dynamic array
            education: getEducationData(), // Dynamic array
            skills: getElementValue('skills-input') || '',
            template: currentTemplate
        };
        
        console.log('Resume data collected:', resumeData);
        
        // Generate HTML preview
        const html = generateTemplateHTML(resumeData, currentTemplate);
        previewElement.innerHTML = html;
        
        console.log('Preview updated successfully');
        
    } catch (error) {
        console.error('Preview update error:', error);
        showMessage('Error updating preview', 'error');
    }
}

// Helper function to safely get element values
function getElementValue(elementId) {
    const element = document.getElementById(elementId);
    return element ? element.value : '';
}

// COMPLETE template HTML generation function
// Updated generateTemplateHTML function - replace the experience section part
// Updated generateTemplateHTML function
function generateTemplateHTML(data, template) {
    try {
        console.log('Generating HTML for template:', template);
        
        // Base header HTML
        let html = `
            <div class="resume-header ${template}-header">
                <h1>${escapeHtml(data.name)}</h1>
                ${data.title ? `<div class="target-role">${escapeHtml(data.title)}</div>` : ''}
                <div class="contact-info">
                    ${data.email ? `<span>📧 ${escapeHtml(data.email)}</span>` : ''}
                    ${data.phone ? `<span>📞 ${escapeHtml(data.phone)}</span>` : ''}
                    ${data.location ? `<span>📍 ${escapeHtml(data.location)}</span>` : ''}
                </div>
            </div>
        `;
        
        // Professional Summary Section
        if (data.summary) {
            html += `
                <div class="resume-section ${template}-section">
                    <h3>Professional Summary</h3>
                    <p>${escapeHtml(data.summary).replace(/\n/g, '<br>')}</p>
                </div>
            `;
        }
        
        // Work Experience Section - UPDATED for dynamic entries
        if (data.experience && Array.isArray(data.experience) && data.experience.length > 0) {
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
        
        // Education Section - UPDATED for dynamic entries
        if (data.education && Array.isArray(data.education) && data.education.length > 0) {
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
        
        // Skills Section
        if (data.skills) {
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


// Save resume data
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

// Export to PDF - FIXED VERSION
async function exportToPDF() {
    try {
        // Ensure we have current data before export
        updatePreview();
        
        if (!resumeData.name || resumeData.name === 'Your Name' || !resumeData.name.trim()) {
            showMessage('Please fill in your name before exporting', 'warning');
            return;
        }
        
        showMessage('Generating PDF...', 'info');
        
        console.log('Exporting resume data:', resumeData); // Debug log
        
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
        
        // Handle file download
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

// Utility functions
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showMessage(message, type = 'info') {
    // Remove existing messages
    const existingMessages = document.querySelectorAll('.status-message');
    existingMessages.forEach(msg => msg.remove());
    
    // Create new message
    const messageDiv = document.createElement('div');
    messageDiv.className = `status-message ${type}`;
    messageDiv.textContent = message;
    
    // Insert at top of form
    const form = document.getElementById('resume-form');
    if (form) {
        form.insertBefore(messageDiv, form.firstChild);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 5000);
    }
}

// Form validation
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
    
    // Email validation
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

// Auto-save functionality
let autoSaveTimeout;
function autoSave() {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => {
        if (resumeData.name && resumeData.name !== 'Your Name') {
            saveResume();
        }
    }, 3000);
}

// Experience management
let experienceEntries = [];
let experienceCounter = 0;

// Initialize experience section
function initializeExperienceSection() {
    const container = document.getElementById('experience-container');
    const addBtn = document.getElementById('add-experience-btn');
    
    if (!container || !addBtn) return;
    
    addBtn.addEventListener('click', addExperienceEntry);
    
    // Add first entry by default
    if (experienceEntries.length === 0) {
        addExperienceEntry();
    }
}

// Add new experience entry
function addExperienceEntry(data = null) {
    experienceCounter++;
    const entryId = `experience-${experienceCounter}`;
    
    const entryData = data || {
        company: '',
        position: '',
        location: '',
        startDate: '',
        endDate: '',
        current: false,
        description: ''
    };
    
    experienceEntries.push({ id: entryId, ...entryData });
    
    const container = document.getElementById('experience-container');
    const entryHTML = generateExperienceEntryHTML(entryId, entryData, experienceEntries.length);
    
    container.insertAdjacentHTML('beforeend', entryHTML);
    
    // Add event listeners for the new entry
    addExperienceEventListeners(entryId);
    
    // Update preview
    updatePreview();
    
    // Focus on company field of new entry
    const companyInput = document.getElementById(`${entryId}-company`);
    if (companyInput) companyInput.focus();
}

// Generate HTML for experience entry - FIXED undefined values
function generateExperienceEntryHTML(entryId, data, index) {
    // Ensure all data properties exist with default empty strings
    const safeData = {
        company: data.company || '',
        position: data.position || '',
        location: data.location || '',
        startDate: data.startDate || '',
        endDate: data.endDate || '',
        current: data.current || false,
        description: data.description || ''
    };
    
    return `
        <div class="experience-entry" id="${entryId}">
            <div class="experience-header">
                <div class="experience-number">${index}</div>
                <h4 class="experience-title">
                    ${safeData.company || safeData.position || 'New Experience'}
                </h4>
                <button type="button" class="remove-experience-btn" onclick="removeExperienceEntry('${entryId}')">
                    ✕
                </button>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="${entryId}-company">Company *</label>
                    <input type="text" id="${entryId}-company" value="${safeData.company}" required>
                </div>
                <div class="form-group">
                    <label for="${entryId}-position">Position *</label>
                    <input type="text" id="${entryId}-position" value="${safeData.position}" required>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="${entryId}-location">Location</label>
                    <input type="text" id="${entryId}-location" value="${safeData.location}" placeholder="City, State">
                </div>
            </div>
            
            <div class="form-group">
                <label>Employment Period</label>
                <div class="date-range">
                    <div class="form-group">
                        <label for="${entryId}-start-date">Start Date</label>
                        <input type="month" id="${entryId}-start-date" value="${safeData.startDate}">
                    </div>
                    <div class="form-group">
                        <label for="${entryId}-end-date">End Date</label>
                        <input type="month" id="${entryId}-end-date" value="${safeData.endDate}" ${safeData.current ? 'disabled' : ''}>
                    </div>
                    <div class="current-position">
                        <input type="checkbox" id="${entryId}-current" ${safeData.current ? 'checked' : ''}>
                        <label for="${entryId}-current">Current Position</label>
                    </div>
                </div>
            </div>
            
            <div class="form-group ai-enhanced">
                <label for="${entryId}-description">Key Achievements & Responsibilities</label>
                <textarea id="${entryId}-description" rows="4" placeholder="• Led team of 5 developers to deliver projects 20% ahead of schedule&#10;• Implemented new system that increased efficiency by 30%&#10;• Managed $2M budget and reduced costs by 15%">${safeData.description}</textarea>
                <button type="button" class="btn-ai" onclick="getExperienceAISuggestion('${entryId}')">🤖 AI Suggest</button>
            </div>
        </div>
    `;
}


// Add event listeners for experience entry
function addExperienceEventListeners(entryId) {
    const inputs = document.querySelectorAll(`#${entryId} input, #${entryId} textarea`);
    
    inputs.forEach(input => {
        input.addEventListener('input', function() {
            updateExperienceEntry(entryId);
            updateExperienceTitle(entryId);
            updatePreview();
            autoSave();
        });
        
        input.addEventListener('focus', function() {
            document.getElementById(entryId).classList.add('active');
        });
        
        input.addEventListener('blur', function() {
            document.getElementById(entryId).classList.remove('active');
        });
    });
    
    // Special handling for current position checkbox
    const currentCheckbox = document.getElementById(`${entryId}-current`);
    const endDateInput = document.getElementById(`${entryId}-end-date`);
    
    if (currentCheckbox && endDateInput) {
        currentCheckbox.addEventListener('change', function() {
            if (this.checked) {
                endDateInput.disabled = true;
                endDateInput.value = '';
            } else {
                endDateInput.disabled = false;
            }
            updateExperienceEntry(entryId);
        });
    }
}

// Update experience entry data
function updateExperienceEntry(entryId) {
    const entry = experienceEntries.find(e => e.id === entryId);
    if (!entry) return;
    
    entry.company = document.getElementById(`${entryId}-company`)?.value || '';
    entry.position = document.getElementById(`${entryId}-position`)?.value || '';
    entry.location = document.getElementById(`${entryId}-location`)?.value || '';
    entry.startDate = document.getElementById(`${entryId}-start-date`)?.value || '';
    entry.endDate = document.getElementById(`${entryId}-end-date`)?.value || '';
    entry.current = document.getElementById(`${entryId}-current`)?.checked || false;
    entry.description = document.getElementById(`${entryId}-description`)?.value || '';
}

// Update experience entry title
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

// Remove experience entry
function removeExperienceEntry(entryId) {
    if (experienceEntries.length <= 1) {
        showMessage('You must have at least one work experience entry.', 'warning');
        return;
    }
    
    if (confirm('Are you sure you want to remove this experience entry?')) {
        // Remove from array
        experienceEntries = experienceEntries.filter(e => e.id !== entryId);
        
        // Remove from DOM
        const entryElement = document.getElementById(entryId);
        if (entryElement) {
            entryElement.remove();
        }
        
        // Update numbering
        updateExperienceNumbering();
        
        // Update preview
        updatePreview();
        autoSave();
        
        showMessage('Experience entry removed successfully!', 'success');
    }
}

// Update experience entry numbering
function updateExperienceNumbering() {
    const container = document.getElementById('experience-container');
    const entries = container.querySelectorAll('.experience-entry');
    
    entries.forEach((entry, index) => {
        const numberElement = entry.querySelector('.experience-number');
        if (numberElement) {
            numberElement.textContent = index + 1;
        }
    });
}

// AI suggestion for specific experience entry
async function getExperienceAISuggestion(entryId) {
    const entry = experienceEntries.find(e => e.id === entryId);
    if (!entry) return;
    
    const textarea = document.getElementById(`${entryId}-description`);
    const content = textarea.value.trim();
    
    if (!content) {
        showMessage('Please enter some job responsibilities before requesting AI suggestions.', 'warning');
        return;
    }
    
    // Create context for AI
    const context = `Position: ${entry.position || 'Professional Role'}\nCompany: ${entry.company || 'Company'}\nResponsibilities: ${content}`;
    
    try {
        isProcessing = true;
        textarea.disabled = true;
        
        showMessage('Getting AI suggestions for your experience...', 'info');
        
        const jobTitle = document.getElementById('title')?.value || entry.position || '';
        
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

// Load experience entries from saved data
function loadExperienceEntries(savedExperience) {
    // Clear existing entries
    experienceEntries = [];
    experienceCounter = 0;
    const container = document.getElementById('experience-container');
    if (container) container.innerHTML = '';
    
    if (Array.isArray(savedExperience) && savedExperience.length > 0) {
        // Load from new format (array of objects)
        savedExperience.forEach(exp => addExperienceEntry(exp));
    } else if (typeof savedExperience === 'string' && savedExperience.trim()) {
        // Convert from old format (single text)
        addExperienceEntry({
            company: '',
            position: '',
            location: '',
            startDate: '',
            endDate: '',
            current: false,
            description: savedExperience
        });
    } else {
        // Add default empty entry
        addExperienceEntry();
    }
}

// Generate experience data for preview and saving
function getExperienceData() {
    return experienceEntries.map(entry => ({
        company: entry.company,
        position: entry.position,
        location: entry.location,
        startDate: entry.startDate,
        endDate: entry.endDate,
        current: entry.current,
        description: entry.description
    }));
}

// Update your existing DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', function() {
    // ... existing code ...
    
    // Initialize experience section
    initializeExperienceSection();
    
    // ... rest of existing code ...
});

// Make functions globally available
window.addExperienceEntry = addExperienceEntry;
window.removeExperienceEntry = removeExperienceEntry;
window.getExperienceAISuggestion = getExperienceAISuggestion;


// Make functions globally available
window.getAISuggestion = getAISuggestion;
window.updatePreview = updatePreview;
window.saveResume = saveResume;
window.exportToPDF = exportToPDF;
window.clearAllContent = clearAllContent;

// Education management
let educationEntries = [];
let educationCounter = 0;

// Initialize education section
function initializeEducationSection() {
    const container = document.getElementById('education-container');
    const addBtn = document.getElementById('add-education-btn');
    
    if (!container || !addBtn) return;
    
    addBtn.addEventListener('click', addEducationEntry);
    
    // Add first entry by default
    if (educationEntries.length === 0) {
        addEducationEntry();
    }
}

// Add new education entry
function addEducationEntry(data = null) {
    educationCounter++;
    const entryId = `education-${educationCounter}`;
    
    const entryData = data || {
        degree: '',
        school: '',
        location: '',
        graduationDate: '',
        gpa: '',
        description: ''
    };
    
    educationEntries.push({ id: entryId, ...entryData });
    
    const container = document.getElementById('education-container');
    const entryHTML = generateEducationEntryHTML(entryId, entryData, educationEntries.length);
    
    container.insertAdjacentHTML('beforeend', entryHTML);
    
    // Add event listeners for the new entry
    addEducationEventListeners(entryId);
    
    // Update preview
    updatePreview();
    
    // Focus on degree field of new entry
    const degreeInput = document.getElementById(`${entryId}-degree`);
    if (degreeInput) degreeInput.focus();
}

// Generate HTML for education entry
function generateEducationEntryHTML(entryId, data, index) {
    // Ensure all data properties exist with default empty strings
    const safeData = {
        degree: data.degree || '',
        school: data.school || '',
        location: data.location || '',
        graduationDate: data.graduationDate || '',
        gpa: data.gpa || '',
        description: data.description || ''
    };
    
    return `
        <div class="education-entry" id="${entryId}">
            <div class="education-header">
                <div class="education-number">${index}</div>
                <h4 class="education-title">
                    ${safeData.degree || safeData.school || 'New Education'}
                </h4>
                <button type="button" class="remove-education-btn" onclick="removeEducationEntry('${entryId}')">
                    ✕
                </button>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="${entryId}-degree">Degree *</label>
                    <input type="text" id="${entryId}-degree" value="${safeData.degree}" placeholder="e.g., Bachelor of Science in Computer Science" required>
                </div>
                <div class="form-group">
                    <label for="${entryId}-school">School *</label>
                    <input type="text" id="${entryId}-school" value="${safeData.school}" placeholder="e.g., University of Technology" required>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="${entryId}-location">Location</label>
                    <input type="text" id="${entryId}-location" value="${safeData.location}" placeholder="City, State">
                </div>
                <div class="form-group">
                    <label for="${entryId}-graduation-date">Graduation Date</label>
                    <input type="month" id="${entryId}-graduation-date" value="${safeData.graduationDate}">
                </div>
            </div>
            
            <div class="form-group">
                <label for="${entryId}-gpa">GPA (Optional)</label>
                <div class="gpa-group">
                    <input type="number" id="${entryId}-gpa" value="${safeData.gpa}" placeholder="3.75" min="0" max="4" step="0.01">
                    <span class="gpa-note">Only include if 3.5+</span>
                </div>
            </div>
            
            <div class="form-group ai-enhanced">
                <label for="${entryId}-description">Relevant Coursework, Honors & Achievements</label>
                <textarea id="${entryId}-description" rows="3" placeholder="• Relevant coursework: Data Structures, Algorithms, Machine Learning&#10;• Dean's List (Fall 2022, Spring 2023)&#10;• Computer Science Club President">${safeData.description}</textarea>
                <button type="button" class="btn-ai" onclick="getEducationAISuggestion('${entryId}')">🤖 AI Suggest</button>
            </div>
        </div>
    `;
}

// Add event listeners for education entry
function addEducationEventListeners(entryId) {
    const inputs = document.querySelectorAll(`#${entryId} input, #${entryId} textarea`);
    
    inputs.forEach(input => {
        input.addEventListener('input', function() {
            updateEducationEntry(entryId);
            updateEducationTitle(entryId);
            updatePreview();
            autoSave();
        });
        
        input.addEventListener('focus', function() {
            document.getElementById(entryId).classList.add('active');
        });
        
        input.addEventListener('blur', function() {
            document.getElementById(entryId).classList.remove('active');
        });
    });
}

// Update education entry data
function updateEducationEntry(entryId) {
    const entry = educationEntries.find(e => e.id === entryId);
    if (!entry) return;
    
    entry.degree = document.getElementById(`${entryId}-degree`)?.value || '';
    entry.school = document.getElementById(`${entryId}-school`)?.value || '';
    entry.location = document.getElementById(`${entryId}-location`)?.value || '';
    entry.graduationDate = document.getElementById(`${entryId}-graduation-date`)?.value || '';
    entry.gpa = document.getElementById(`${entryId}-gpa`)?.value || '';
    entry.description = document.getElementById(`${entryId}-description`)?.value || '';
}

// Update education entry title
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

// Remove education entry
function removeEducationEntry(entryId) {
    if (educationEntries.length <= 1) {
        showMessage('You must have at least one education entry.', 'warning');
        return;
    }
    
    if (confirm('Are you sure you want to remove this education entry?')) {
        // Remove from array
        educationEntries = educationEntries.filter(e => e.id !== entryId);
        
        // Remove from DOM
        const entryElement = document.getElementById(entryId);
        if (entryElement) {
            entryElement.remove();
        }
        
        // Update numbering
        updateEducationNumbering();
        
        // Update preview
        updatePreview();
        autoSave();
        
        showMessage('Education entry removed successfully!', 'success');
    }
}

// Update education entry numbering
function updateEducationNumbering() {
    const container = document.getElementById('education-container');
    const entries = container.querySelectorAll('.education-entry');
    
    entries.forEach((entry, index) => {
        const numberElement = entry.querySelector('.education-number');
        if (numberElement) {
            numberElement.textContent = index + 1;
        }
    });
}

// AI suggestion for specific education entry
async function getEducationAISuggestion(entryId) {
    const entry = educationEntries.find(e => e.id === entryId);
    if (!entry) return;
    
    const textarea = document.getElementById(`${entryId}-description`);
    const content = textarea.value.trim();
    
    if (!content) {
        showMessage('Please enter some coursework or achievements before requesting AI suggestions.', 'warning');
        return;
    }
    
    // Create context for AI
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
                job_title: document.getElementById('title')?.value || ''
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

// Get education data for preview and saving
function getEducationData() {
    return educationEntries.map(entry => ({
        degree: entry.degree,
        school: entry.school,
        location: entry.location,
        graduationDate: entry.graduationDate,
        gpa: entry.gpa,
        description: entry.description
    }));
}

// Load education entries from saved data
function loadEducationEntries(savedEducation) {
    // Clear existing entries
    educationEntries = [];
    educationCounter = 0;
    const container = document.getElementById('education-container');
    if (container) container.innerHTML = '';
    
    if (Array.isArray(savedEducation) && savedEducation.length > 0) {
        // Load from new format (array of objects)
        savedEducation.forEach(edu => addEducationEntry(edu));
    } else if (typeof savedEducation === 'string' && savedEducation.trim()) {
        // Convert from old format (single text)
        addEducationEntry({
            degree: '',
            school: '',
            location: '',
            graduationDate: '',
            gpa: '',
            description: savedEducation
        });
    } else {
        // Add default empty entry
        addEducationEntry();
    }
}

// Add to your DOMContentLoaded event listener:
document.addEventListener('DOMContentLoaded', function() {
    // ... existing code ...
    
    // Initialize education section
    initializeEducationSection();
    
    // ... rest of existing code ...
});

// Make functions globally available
window.addEducationEntry = addEducationEntry;
window.removeEducationEntry = removeEducationEntry;
window.getEducationAISuggestion = getEducationAISuggestion;



// Get education data for preview and saving
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

// Get experience data for preview and saving
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

// Load education entries from saved data
function loadEducationEntries(savedEducation) {
    // Clear existing entries
    educationEntries = [];
    educationCounter = 0;
    const container = document.getElementById('education-container');
    if (container) container.innerHTML = '';
    
    if (Array.isArray(savedEducation) && savedEducation.length > 0) {
        // Load from new format (array of objects)
        savedEducation.forEach(edu => addEducationEntry(edu));
    } else if (typeof savedEducation === 'string' && savedEducation.trim()) {
        // Convert from old format (single text)
        addEducationEntry({
            degree: '',
            school: '',
            location: '',
            graduationDate: '',
            gpa: '',
            description: savedEducation
        });
    } else {
        // Add default empty entry
        addEducationEntry();
    }
}

// Load experience entries from saved data
function loadExperienceEntries(savedExperience) {
    // Clear existing entries
    experienceEntries = [];
    experienceCounter = 0;
    const container = document.getElementById('experience-container');
    if (container) container.innerHTML = '';
    
    if (Array.isArray(savedExperience) && savedExperience.length > 0) {
        // Load from new format (array of objects)
        savedExperience.forEach(exp => addExperienceEntry(exp));
    } else if (typeof savedExperience === 'string' && savedExperience.trim()) {
        // Convert from old format (single text)
        addExperienceEntry({
            company: '',
            position: '',
            location: '',
            startDate: '',
            endDate: '',
            current: false,
            description: savedExperience
        });
    } else {
        // Add default empty entry
        addExperienceEntry();
    }
}

// Make functions globally available
window.addExperienceEntry = addExperienceEntry;
window.removeExperienceEntry = removeExperienceEntry;
window.getExperienceAISuggestion = getExperienceAISuggestion;
window.addEducationEntry = addEducationEntry;
window.removeEducationEntry = removeEducationEntry;
window.getEducationAISuggestion = getEducationAISuggestion;

