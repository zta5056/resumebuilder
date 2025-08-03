// Global variables
let isProcessing = false;
let resumeData = {};

// Enhanced AI suggestion function with error handling
async function getAISuggestion(section) {
    if (isProcessing) return;
    
    const textarea = document.getElementById(section + '-input');
    const btn = textarea?.nextElementSibling;
    
    if (!textarea || !btn) {
        console.error(`Elements not found for section: ${section}`);
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

// Enhanced preview update function
function updatePreview() {
    try {
        const previewElement = document.getElementById('resume-preview');
        if (!previewElement) return;
        
        // Collect all form data
        resumeData = {
            name: document.getElementById('name')?.value || 'Your Name',
            title: document.getElementById('title')?.value || '',
            email: document.getElementById('email')?.value || '',
            phone: document.getElementById('phone')?.value || '',
            location: document.getElementById('location')?.value || '',
            summary: document.getElementById('summary-input')?.value || '',
            experience: document.getElementById('experience-input')?.value || '',
            education: document.getElementById('education-input')?.value || '',
            skills: document.getElementById('skills-input')?.value || ''
        };
        
        // Generate HTML preview
        let html = `
            <div class="resume-header">
                <h1>${escapeHtml(resumeData.name)}</h1>
                ${resumeData.title ? `<div class="target-role">${escapeHtml(resumeData.title)}</div>` : ''}
                <div class="contact-info">
                    ${resumeData.email ? `<span>📧 ${escapeHtml(resumeData.email)}</span>` : ''}
                    ${resumeData.phone ? `<span>📞 ${escapeHtml(resumeData.phone)}</span>` : ''}
                    ${resumeData.location ? `<span>📍 ${escapeHtml(resumeData.location)}</span>` : ''}
                </div>
            </div>
        `;
        
        if (resumeData.summary) {
            html += `
                <div class="resume-section">
                    <h3>Professional Summary</h3>
                    <p>${escapeHtml(resumeData.summary).replace(/\n/g, '<br>')}</p>
                </div>
            `;
        }
        
        if (resumeData.experience) {
            html += `
                <div class="resume-section">
                    <h3>Work Experience</h3>
                    <div class="experience-entry">
                        <p>${escapeHtml(resumeData.experience).replace(/\n/g, '<br>')}</p>
                    </div>
                </div>
            `;
        }
        
        if (resumeData.education) {
            html += `
                <div class="resume-section">
                    <h3>Education</h3>
                    <div class="education-entry">
                        <p>${escapeHtml(resumeData.education).replace(/\n/g, '<br>')}</p>
                    </div>
                </div>
            `;
        }
        
        if (resumeData.skills) {
            const skillsArray = resumeData.skills.split(',').map(s => s.trim()).filter(s => s);
            if (skillsArray.length > 0) {
                html += `
                    <div class="resume-section">
                        <h3>Skills</h3>
                        <div class="skills-list">
                            ${skillsArray.map(skill => `<span class="skill-tag">${escapeHtml(skill)}</span>`).join('')}
                        </div>
                    </div>
                `;
            }
        }
        
        previewElement.innerHTML = html;
        
    } catch (error) {
        console.error('Preview update error:', error);
        showMessage('Error updating preview', 'error');
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
        a.download = `${resumeData.name.replace(' ', '_')}_Resume.pdf`;
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
        updatePreview();
        saveResume();
    }, 2000);
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Auto-update preview on input
    const inputs = document.querySelectorAll('input, textarea');
    inputs.forEach(input => {
        input.addEventListener('input', () => {
            updatePreview();
            autoSave();
        });
        
        // Clear error styling on focus
        input.addEventListener('focus', () => {
            input.style.borderColor = 'var(--primary)';
        });
    });
    
    // Export button
    const exportBtn = document.getElementById('export-pdf-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportToPDF);
    }
    
    // Save button
    const saveBtn = document.getElementById('save-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            if (validateForm()) {
                saveResume();
            }
        });
    }
    
    // Initial preview update
    updatePreview();
});

// Make functions globally available
window.getAISuggestion = getAISuggestion;
window.updatePreview = updatePreview;
window.saveResume = saveResume;
window.exportToPDF = exportToPDF;
