import os
from flask import Flask, render_template, request, jsonify, session, send_file
from flask_session import Session
from flask_cors import CORS
import openai
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
import io
from datetime import datetime
import PyPDF2
import docx
from werkzeug.utils import secure_filename
import json

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "dev_secret_key_change_in_production")
app.config['SESSION_TYPE'] = 'filesystem'
Session(app)
CORS(app, supports_credentials=True)

# Enhanced OpenAI client initialization with better error handling
try:
    client = openai.OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    if not os.environ.get("OPENAI_API_KEY"):
        print("Warning: OPENAI_API_KEY not found in environment variables")
        client = None
except Exception as e:
    print(f"Error initializing OpenAI client: {e}")
    client = None

# ===== MAIN ROUTES =====

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/templates')
def templates():
    return render_template('template_chooser.html')

@app.route('/builder', methods=['GET', 'POST'])
def builder():
    if request.method == 'POST':
        try:
            resume_data = request.json
            if not resume_data:
                return jsonify({'status': 'error', 'message': 'No resume data provided'}), 400

            # Validate essential data
            if not resume_data.get('name', '').strip():
                return jsonify({'status': 'error', 'message': 'Name is required'}), 400

            # Store comprehensive resume data with enhanced validation
            session['resume_data'] = {
                'personal_info': {
                    'name': resume_data.get('name', '').strip(),
                    'title': resume_data.get('title', '').strip(),
                    'email': resume_data.get('email', '').strip(),
                    'phone': resume_data.get('phone', '').strip(),
                    'location': resume_data.get('location', '').strip(),
                    'linkedin': resume_data.get('linkedin', '').strip(),
                    'website': resume_data.get('website', '').strip(),
                    'github': resume_data.get('github', '').strip()
                },
                'summary': resume_data.get('summary', '').strip(),
                'experience': validate_dynamic_section(resume_data.get('experience', [])),
                'education': validate_dynamic_section(resume_data.get('education', [])),
                'projects': validate_dynamic_section(resume_data.get('projects', [])),
                'skills': resume_data.get('skills', '').strip(),
                'template': resume_data.get('template', 'classic'),
                'timestamp': datetime.now().isoformat()
            }
            
            return jsonify({'status': 'success', 'message': 'Resume saved successfully'})
            
        except Exception as e:
            print(f"Error saving resume: {str(e)}")  # Debug log
            return jsonify({'status': 'error', 'message': f'Error saving resume: {str(e)}'}), 500

    # GET request handling
    selected_template = request.args.get('template', 'classic')
    
    # Get saved resume data with proper fallbacks
    saved_data = session.get('resume_data', {})
    if not saved_data:
        saved_data = initialize_empty_resume(selected_template)
    
    # Update template if specified in URL
    if request.args.get('template'):
        saved_data['template'] = selected_template
        session['resume_data'] = saved_data

    return render_template('builder.html', 
                         selected_template=selected_template, 
                         resume_data=saved_data)

def initialize_empty_resume(template='classic'):
    """Initialize empty resume structure with all required fields"""
    return {
        'personal_info': {
            'name': '', 'title': '', 'email': '', 'phone': '', 'location': '',
            'linkedin': '', 'website': '', 'github': ''
        },
        'summary': '',
        'experience': [],
        'education': [],
        'projects': [],
        'skills': '',
        'template': template
    }

def validate_dynamic_section(section_data):
    """Validate and clean dynamic section data"""
    if not isinstance(section_data, list):
        return []
    
    validated = []
    for item in section_data:
        if isinstance(item, dict) and any(item.values()):
            # Clean empty string values but keep the structure
            cleaned_item = {k: v.strip() if isinstance(v, str) else v 
                          for k, v in item.items()}
            validated.append(cleaned_item)
    
    return validated

# ===== SESSION MANAGEMENT =====

@app.route('/clear_session', methods=['POST'])
def clear_session():
    """Clear all resume data from session"""
    try:
        session.pop('resume_data', None)
        session.pop('last_analysis', None)
        return jsonify({'status': 'success', 'message': 'Session cleared successfully'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Error clearing session: {str(e)}'}), 500

@app.route('/get_resume_data', methods=['GET'])
def get_resume_data():
    """API endpoint to get saved resume data"""
    resume_data = session.get('resume_data', {})
    return jsonify(resume_data)

# ===== AI FEATURES =====

@app.route('/ai_suggest', methods=['POST'])
def ai_suggest():
    try:
        if not client:
            return jsonify({'error': 'AI service temporarily unavailable'}), 503

        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        section = data.get('section', '').strip()
        content = data.get('content', '').strip()
        job_title = data.get('job_title', '').strip()

        # Enhanced validation
        if not section or not content:
            return jsonify({'error': 'Section and content are required'}), 400
        
        if len(content) > 2000:
            return jsonify({'error': 'Content too long. Please limit to 2000 characters.'}), 400

        # Enhanced prompts with better instructions
        prompts = {
            'summary': f"""Rewrite this professional summary for a resume. Make it:
- Compelling and results-oriented
- 2-3 sentences maximum
- Include relevant keywords for {job_title if job_title else 'professional roles'}
- Quantify achievements where possible
- ATS-optimized

Original: {content}""",

            'experience': f"""Rewrite this work experience description. Make it:
- Use strong action verbs (Led, Achieved, Implemented, etc.)
- Include specific metrics and results
- ATS-friendly with relevant keywords
- 3-4 bullet points maximum
- Tailored for {job_title if job_title else 'professional roles'}
- Each bullet point should start with •

Original: {content}""",

            'education': f"""Enhance this education section. Include:
- Relevant coursework, honors, or achievements
- GPA only if 3.5 or higher
- Any relevant projects or certifications
- Format for ATS compatibility

Original: {content}""",

            'skills': f"""Organize these skills effectively for a resume:
- Return as comma-separated list only
- Relevant to {job_title if job_title else 'professional roles'}
- Include both technical and soft skills
- ATS-optimized keywords
- No bullet points or categories, just comma-separated

Original: {content}""",

            'projects': f"""Rewrite this project description for a resume. Make it:
- Focus on technical achievements and impact
- Include specific metrics and results where possible
- Highlight technologies and methodologies used
- Use strong action verbs (Built, Developed, Implemented, etc.)
- Show problem-solving and technical skills
- ATS-friendly with relevant keywords for {job_title if job_title else 'technical roles'}
- Format with bullet points starting with •

Original: {content}"""
        }

        prompt = prompts.get(section, f"Improve this {section} section for a professional resume:\n\n{content}")

        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a professional resume writer specializing in ATS-optimized content and modern hiring practices. Always follow the specific formatting instructions provided."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=300,
            temperature=0.4
        )

        suggestion = response.choices[0].message.content.strip()
        return jsonify({'suggestion': suggestion})

    except openai.APIError as e:
        print(f"OpenAI API error: {str(e)}")
        return jsonify({'error': f'AI service error: {str(e)}'}), 502
    except Exception as e:
        print(f"AI suggestion error: {str(e)}")
        return jsonify({'error': f'Error generating suggestion: {str(e)}'}), 500

# ===== RESUME REVIEWER =====

@app.route('/reviewer', methods=['GET', 'POST'])
def reviewer():
    if request.method == 'POST':
        try:
            resume_text = request.form.get('resume_text', '').strip()
            
            if not resume_text:
                return render_template('reviewer.html', error="Please provide resume text to review")
            
            if len(resume_text) < 50:
                return render_template('reviewer.html', error="Resume text too short. Please provide a complete resume.")
            
            if not client:
                return render_template('reviewer.html', error="AI service temporarily unavailable. Please try again later.")

            # Enhanced AI prompt for comprehensive review
            review_prompt = f"""As an expert resume reviewer and ATS specialist, analyze this resume and provide a detailed review in the following format:

OVERALL SCORE: [Score out of 10]

ATS COMPATIBILITY: [High/Medium/Low] - [Brief explanation]

STRENGTHS:
• [List 3-4 specific strengths]

WEAKNESSES:
• [List 3-4 areas for improvement]

KEYWORD OPTIMIZATION:
• Missing keywords: [List specific keywords]
• Suggestions: [How to incorporate them]

FORMATTING ISSUES:
• [Any structural problems or improvements needed]

ACTION ITEMS:
1. [Specific improvement #1]
2. [Specific improvement #2]
3. [Specific improvement #3]
4. [Specific improvement #4]

Resume to analyze:
{resume_text}
"""

            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are an expert resume reviewer specializing in ATS optimization and modern hiring practices. Provide detailed, actionable feedback."},
                    {"role": "user", "content": review_prompt}
                ],
                max_tokens=800,
                temperature=0.3
            )

            feedback = response.choices[0].message.content

            # Store analysis in session for download
            session['last_analysis'] = {
                'resume_text': resume_text,
                'feedback': feedback,
                'timestamp': datetime.now().isoformat()
            }

            return render_template('reviewer.html', feedback=feedback, resume_text=resume_text)

        except openai.APIError as e:
            print(f"OpenAI API error in reviewer: {str(e)}")
            return render_template('reviewer.html', error=f"AI service error: {str(e)}")
        except Exception as e:
            print(f"Error analyzing resume: {str(e)}")
            return render_template('reviewer.html', error=f"Error analyzing resume: {str(e)}")

    return render_template('reviewer.html')

@app.route('/upload_resume', methods=['POST'])
def upload_resume():
    try:
        if 'resume_file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['resume_file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        # Enhanced file validation
        allowed_extensions = {'.pdf', '.doc', '.docx'}
        file_ext = os.path.splitext(secure_filename(file.filename))[1].lower()
        
        if file_ext not in allowed_extensions:
            return jsonify({'error': 'Invalid file type. Please upload PDF, DOC, or DOCX files only.'}), 400

        # Check file size (5MB limit)
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        
        if file_size > 5 * 1024 * 1024:
            return jsonify({'error': 'File too large. Please upload files under 5MB.'}), 400

        # Extract text based on file type
        text_content = ""
        
        if file_ext == '.pdf':
            try:
                pdf_reader = PyPDF2.PdfReader(file)
                for page in pdf_reader.pages:
                    text_content += page.extract_text() + "\n"
            except Exception as e:
                return jsonify({'error': 'Error reading PDF file. Please try a different file.'}), 400
                
        elif file_ext in ['.doc', '.docx']:
            try:
                doc = docx.Document(file)
                for paragraph in doc.paragraphs:
                    text_content += paragraph.text + "\n"
            except Exception as e:
                return jsonify({'error': 'Error reading Word document. Please try a different file.'}), 400

        if not text_content.strip():
            return jsonify({'error': 'Could not extract text from the file. Please try a different file or paste the text manually.'}), 400

        return jsonify({
            'status': 'success',
            'text': text_content.strip(),
            'filename': secure_filename(file.filename)
        })

    except Exception as e:
        print(f"File upload error: {str(e)}")
        return jsonify({'error': f'Error processing file: {str(e)}'}), 500

@app.route('/download_report', methods=['GET'])
def download_report():
    """Generate and download analysis report as PDF"""
    try:
        analysis = session.get('last_analysis')
        if not analysis:
            return jsonify({'error': 'No analysis found. Please analyze a resume first.'}), 404

        # Create PDF in memory
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=1*inch, bottomMargin=1*inch)

        # Enhanced styles
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'ReportTitle',
            parent=styles['Heading1'],
            fontSize=20,
            textColor=colors.HexColor('#1e40af'),
            alignment=1,  # Center
            spaceAfter=20
        )

        heading_style = ParagraphStyle(
            'ReportHeading',
            parent=styles['Heading2'],
            fontSize=14,
            textColor=colors.HexColor('#1e40af'),
            spaceAfter=10,
            spaceBefore=15
        )

        normal_style = ParagraphStyle(
            'ReportNormal',
            parent=styles['Normal'],
            fontSize=10,
            spaceAfter=6,
            leftIndent=10
        )

        # Build PDF content
        story = []

        # Title
        story.append(Paragraph("AI Resume Analysis Report", title_style))
        story.append(Paragraph(f"Generated on: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}", styles['Normal']))
        story.append(Spacer(1, 20))

        # Resume Text Section
        story.append(Paragraph("ANALYZED RESUME", heading_style))
        resume_text = analysis['resume_text'][:1000] + "..." if len(analysis['resume_text']) > 1000 else analysis['resume_text']
        story.append(Paragraph(resume_text, normal_style))
        story.append(Spacer(1, 20))

        # Analysis Section
        story.append(Paragraph("DETAILED ANALYSIS", heading_style))
        feedback_lines = analysis['feedback'].split('\n')
        for line in feedback_lines:
            if line.strip():
                story.append(Paragraph(line.strip(), normal_style))

        story.append(Spacer(1, 30))

        # Footer
        story.append(Paragraph("This report was generated by AI Resume Builder - Visit us for more tools!", styles['Italic']))

        # Build PDF
        doc.build(story)
        buffer.seek(0)

        return send_file(
            buffer,
            as_attachment=True,
            download_name=f"Resume_Analysis_Report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf",
            mimetype='application/pdf'
        )

    except Exception as e:
        print(f"Report generation error: {str(e)}")
        return jsonify({'error': f'Error generating report: {str(e)}'}), 500

# ===== PDF EXPORT =====

@app.route('/export_pdf', methods=['POST'])
def export_pdf():
    try:
        resume_data = request.json
        if not resume_data:
            return jsonify({'error': 'No resume data provided'}), 400

        template = resume_data.get('template', 'classic')

        # Create PDF in memory
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)

        # Template-specific styles
        styles = getSampleStyleSheet()
        title_style, heading_style = get_template_styles(template, styles)

        normal_style = styles['Normal']
        normal_style.fontSize = 10

        # Build PDF content
        story = []

        # Header
        name = resume_data.get('name', 'Your Name')
        title = resume_data.get('title', '')
        
        story.append(Paragraph(name, title_style))
        if title:
            story.append(Paragraph(title, styles['Heading3']))
        story.append(Spacer(1, 12))

        # Enhanced Contact Info
        contact_info = []
        contact_fields = ['email', 'phone', 'location', 'linkedin', 'website', 'github']
        
        for field in contact_fields:
            if resume_data.get(field):
                if field in ['linkedin', 'website', 'github']:
                    contact_info.append(f"{field.title()}: {resume_data[field]}")
                else:
                    contact_info.append(resume_data[field])

        if contact_info:
            # Split contact info into multiple lines if too long
            if len(' | '.join(contact_info)) > 100:
                for i in range(0, len(contact_info), 3):
                    story.append(Paragraph(' | '.join(contact_info[i:i+3]), normal_style))
            else:
                story.append(Paragraph(' | '.join(contact_info), normal_style))
        story.append(Spacer(1, 12))

        # Summary
        if resume_data.get('summary'):
            story.append(Paragraph('PROFESSIONAL SUMMARY', heading_style))
            story.append(Paragraph(resume_data['summary'], normal_style))
            story.append(Spacer(1, 12))

        # Dynamic Experience Section
        add_experience_section(story, resume_data, heading_style, normal_style)

        # Dynamic Projects Section
        add_projects_section(story, resume_data, heading_style, normal_style)

        # Dynamic Education Section
        add_education_section(story, resume_data, heading_style, normal_style)

        # Skills
        if resume_data.get('skills'):
            story.append(Paragraph('SKILLS', heading_style))
            story.append(Paragraph(resume_data['skills'], normal_style))

        # Build PDF
        doc.build(story)
        buffer.seek(0)

        return send_file(
            buffer,
            as_attachment=True,
            download_name=f"{name.replace(' ', '_')}_Resume_{template.title()}.pdf",
            mimetype='application/pdf'
        )

    except Exception as e:
        print(f"PDF Export Error: {str(e)}")
        return jsonify({'error': f'Error generating PDF: {str(e)}'}), 500

def get_template_styles(template, styles):
    """Get template-specific styles for PDF generation"""
    if template == 'classic':
        title_style = ParagraphStyle(
            'ClassicTitle',
            parent=styles['Heading1'],
            fontSize=18,
            textColor=colors.HexColor('#1e40af'),
            alignment=1,
            spaceAfter=12
        )
        heading_style = ParagraphStyle(
            'ClassicHeading',
            parent=styles['Heading2'],
            fontSize=12,
            textColor=colors.HexColor('#1e40af'),
            spaceAfter=6,
            borderWidth=1,
            borderColor=colors.HexColor('#1e40af'),
            borderPadding=3
        )
    elif template == 'modern':
        title_style = ParagraphStyle(
            'ModernTitle',
            parent=styles['Heading1'],
            fontSize=20,
            textColor=colors.HexColor('#3b82f6'),
            alignment=1,
            spaceAfter=16
        )
        heading_style = ParagraphStyle(
            'ModernHeading',
            parent=styles['Heading2'],
            fontSize=13,
            textColor=colors.HexColor('#3b82f6'),
            spaceAfter=8,
            backColor=colors.HexColor('#eff6ff'),
            borderPadding=5
        )
    else:  # creative
        title_style = ParagraphStyle(
            'CreativeTitle',
            parent=styles['Heading1'],
            fontSize=22,
            textColor=colors.HexColor('#06b6d4'),
            alignment=1,
            spaceAfter=18
        )
        heading_style = ParagraphStyle(
            'CreativeHeading',
            parent=styles['Heading2'],
            fontSize=14,
            textColor=colors.HexColor('#06b6d4'),
            spaceAfter=10,
            leftIndent=10,
            borderWidth=0,
            borderColor=colors.HexColor('#06b6d4')
        )
    
    return title_style, heading_style

def add_experience_section(story, resume_data, heading_style, normal_style):
    """Add dynamic experience section to PDF"""
    if resume_data.get('experience') and isinstance(resume_data['experience'], list):
        story.append(Paragraph('WORK EXPERIENCE', heading_style))
        
        for exp in resume_data['experience']:
            if isinstance(exp, dict) and (exp.get('company') or exp.get('position')):
                # Position and Company
                if exp.get('position') and exp.get('company'):
                    story.append(Paragraph(f"<b>{exp['position']}</b> - {exp['company']}", normal_style))
                elif exp.get('position'):
                    story.append(Paragraph(f"<b>{exp['position']}</b>", normal_style))
                elif exp.get('company'):
                    story.append(Paragraph(f"<b>{exp['company']}</b>", normal_style))

                # Dates and Location
                date_location = []
                if exp.get('startDate') or exp.get('endDate') or exp.get('current'):
                    date_range = format_date_range(exp)
                    if date_range:
                        date_location.append(date_range)

                if exp.get('location'):
                    date_location.append(exp['location'])

                if date_location:
                    story.append(Paragraph(' | '.join(date_location), normal_style))

                # Description
                if exp.get('description'):
                    story.append(Paragraph(exp['description'], normal_style))

                story.append(Spacer(1, 8))
        story.append(Spacer(1, 4))

def add_projects_section(story, resume_data, heading_style, normal_style):
    """Add dynamic projects section to PDF"""
    if resume_data.get('projects') and isinstance(resume_data['projects'], list):
        story.append(Paragraph('PROJECTS', heading_style))
        
        for project in resume_data['projects']:
            if isinstance(project, dict) and project.get('name'):
                # Project Name
                story.append(Paragraph(f"<b>{project['name']}</b>", normal_style))

                # Technologies and dates
                details = []
                if project.get('technologies'):
                    details.append(f"Technologies: {project['technologies']}")

                date_range = format_date_range(project)
                if date_range:
                    details.append(date_range)

                if details:
                    story.append(Paragraph(' | '.join(details), normal_style))

                # Description
                if project.get('description'):
                    story.append(Paragraph(project['description'], normal_style))

                # Links
                links = []
                if project.get('githubUrl'):
                    links.append(f"GitHub: {project['githubUrl']}")
                if project.get('demoUrl'):
                    links.append(f"Demo: {project['demoUrl']}")
                if links:
                    story.append(Paragraph(' | '.join(links), normal_style))

                story.append(Spacer(1, 8))
        story.append(Spacer(1, 4))

def add_education_section(story, resume_data, heading_style, normal_style):
    """Add dynamic education section to PDF"""
    if resume_data.get('education') and isinstance(resume_data['education'], list):
        story.append(Paragraph('EDUCATION', heading_style))
        
        for edu in resume_data['education']:
            if isinstance(edu, dict) and (edu.get('degree') or edu.get('school')):
                # Degree and School
                if edu.get('degree') and edu.get('school'):
                    story.append(Paragraph(f"<b>{edu['degree']}</b> - {edu['school']}", normal_style))
                elif edu.get('degree'):
                    story.append(Paragraph(f"<b>{edu['degree']}</b>", normal_style))
                elif edu.get('school'):
                    story.append(Paragraph(f"<b>{edu['school']}</b>", normal_style))

                # Date, Location, GPA
                details = []
                if edu.get('graduationDate'):
                    try:
                        grad_date = datetime.strptime(edu['graduationDate'] + '-01', '%Y-%m-%d')
                        details.append(grad_date.strftime('%b %Y'))
                    except:
                        details.append(edu['graduationDate'])

                if edu.get('location'):
                    details.append(edu['location'])

                if edu.get('gpa') and float(edu['gpa']) >= 3.5:
                    details.append(f"GPA: {edu['gpa']}")

                if details:
                    story.append(Paragraph(' | '.join(details), normal_style))

                # Description
                if edu.get('description'):
                    story.append(Paragraph(edu['description'], normal_style))

                story.append(Spacer(1, 8))
        story.append(Spacer(1, 4))

def format_date_range(entry):
    """Format date range for entries"""
    date_range = ''
    
    if entry.get('startDate'):
        try:
            start_date = datetime.strptime(entry['startDate'] + '-01', '%Y-%m-%d')
            date_range += start_date.strftime('%b %Y')
        except:
            date_range += entry['startDate']

    if entry.get('current'):
        date_range += ' - Present'
    elif entry.get('endDate'):
        try:
            end_date = datetime.strptime(entry['endDate'] + '-01', '%Y-%m-%d')
            date_range += ' - ' + end_date.strftime('%b %Y')
        except:
            date_range += ' - ' + entry['endDate']
    
    return date_range

# ===== UTILITY ROUTES =====

@app.route('/health')
def health_check():
    """Health check endpoint for monitoring"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'openai_available': client is not None
    })

if __name__ == '__main__':
    app.run(debug=True)
