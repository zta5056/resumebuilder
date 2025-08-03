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
    
    // Load saved data if available
    loadSavedData();
    
    // Initial preview update with delay to ensure DOM is ready
    setTimeout(() => {
        console.log('Running initial preview update...');
        updatePreview();
    }, 200);
});

// Load saved resume data from server
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
            if (savedData.experience && document.getElementById('experience-input')) {
                document.getElementById('experience-input').value = savedData.experience;
            }
            if (savedData.education && document.getElementById('education-input')) {
                document.getElementById('education-input').value = savedData.education;
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

// Enhanced AI suggestion function
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
        btn.innerHTML = '<span class="btn-loading">🤖</span> Thinking...';
        
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
            textarea.value = data.suggestion;
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

// Enhanced preview update function with proper template support
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
        
        // Collect all form data
        resumeData = {
            name: getElementValue('name') || 'Your Name',
            title: getElementValue('title') || '',
            email: getElementValue('email') || '',
            phone: getElementValue('phone') || '',
            location: getElementValue('location') || '',
            summary: getElementValue('summary-input') || '',
            experience: getElementValue('experience-input') || '',
            education: getElementValue('education-input') || '',
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

// Complete template HTML generation function
function generateTemplateHTML(data, template) {
    try {
        console.log('Generating HTML for template:', template);
        
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
        
        if (data.summary) {
            html += `
                <div class="resume-section ${template}-section">
                    <h3>Professional Summary</h3>
                    <p>${escapeHtml(data.summary).replace(/\n/g, '<br>')}</p>
                </div>
            `;
        }
        
        if (data.experience) {
            html += `
                <div class="resume-section ${template}-section">
                    <h3>Work Experience</h3>
                    <div class="experience-entry">
                        <p>${escapeHtml(data.experience).replace(/\n/g, '<br>')}</p>
                    </div>
                </div>
            `;
        }
        
        if (data.education) {
            html += `
                <div class="resume-section ${template}-section">
                    <h3>Education</h3>
                    <div class="education-entry">
                        <p>${escapeHtml(data.education).replace(/\n/g, '<br>')}</p>
                    </div>
                </div>
            `;
        }
        
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
        
        return html;
        
    } catch (error) {
        console.error('Error generating template HTML:', error);
        return '<p style="color: red;">Error generating preview</p>';
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

// Export to PDF
async function exportToPDF() {
    try {
        if (!resumeData.name || resumeData.name === 'Your Name') {
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
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to generate PDF');
        }
        
        // Handle file download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${resumeData.name.replace(' ', '_')}_Resume_${currentTemplate}.pdf`;
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
    }, 3000); // Save after 3 seconds of inactivity
}

// Make functions globally available
window.getAISuggestion = getAISuggestion;
window.updatePreview = updatePreview;
window.saveResume = saveResume;
window.exportToPDF = exportToPDF;
