async function getAISuggestion(section) {
    let textarea = document.getElementById(section + '-input');
    let content = textarea.value;
    textarea.disabled = true;
    let btn = textarea.nextElementSibling;
    btn.textContent = "Thinking...";
    const response = await fetch('/ai_suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: section, content: content })
    });
    let data = await response.json();
    textarea.value = data.suggestion;
    btn.textContent = "AI Suggest";
    textarea.disabled = false;
}
function updatePreview() {
    let name = document.getElementById('name').value;
    let title = document.getElementById('title').value;
    let summary = document.getElementById('summary-input').value;
    let experience = document.getElementById('experience-input').value;
    let education = document.getElementById('education-input').value;
    let skills = document.getElementById('skills-input').value;
    let html = `
        <h1>${name || "Your Name"}</h1>
        <h2>${title || ""}</h2>
        <h3>Summary</h3><p>${summary}</p>
        <h3>Work Experience</h3><p>${experience}</p>
        <h3>Education</h3><p>${education}</p>
        <h3>Skills</h3><ul>${skills.split(',').map(s => `<li>${s.trim()}</li>`).join('')}</ul>
    `;
    document.getElementById('resume-preview').innerHTML = html;
}

