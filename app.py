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


app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "dev_secret_key_change_in_production")
app.config['SESSION_TYPE'] = 'filesystem'
Session(app)
CORS(app, supports_credentials=True)

# Updated OpenAI client initialization with error handling
try:
    client = openai.OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    if not os.environ.get("OPENAI_API_KEY"):
        print("Warning: OPENAI_API_KEY not found in environment variables")
except Exception as e:
    print(f"Error initializing OpenAI client: {e}")
    client = None

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
            # Enhanced data validation
            resume_data = request.json
            if not resume_data:
                return jsonify({'status': 'error', 'message': 'No resume data provided'}), 400
            
            # Store in session with validation
            session['resume_data'] = {
                'personal_info': resume_data.get('personal_info', {}),
                'summary': resume_data.get('summary', ''),
                'experience': resume_data.get('experience', []),
                'education': resume_data.get('education', []),
                'skills': resume_data.get('skills', []),
                'timestamp': datetime.now().isoformat()
            }
            return jsonify({'status': 'success', 'message': 'Resume saved successfully'})
        except Exception as e:
            return jsonify({'status': 'error', 'message': f'Error saving resume: {str(e)}'}), 500
    
    return render_template('builder.html')

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
            
            # Enhanced AI prompt for better review
            review_prompt = f"""
            As an expert resume reviewer and ATS specialist, analyze this resume and provide:
            
            1. OVERALL SCORE (1-10): Rate the resume's effectiveness
            2. ATS COMPATIBILITY: How well will it pass automated screening?
            3. STRENGTHS: What works well in this resume
            4. WEAKNESSES: Areas that need improvement
            5. KEYWORD OPTIMIZATION: Missing keywords and suggestions
            6. FORMATTING ISSUES: Any structural problems
            7. ACTION ITEMS: 3-5 specific improvements to make
            
            Resume to analyze:
            {resume_text}
            """
            
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are an expert resume reviewer specializing in ATS optimization and modern hiring practices."},
                    {"role": "user", "content": review_prompt}
                ],
                max_tokens=600,
                temperature=0.3
            )
            
            feedback = response.choices[0].message.content
            return render_template('reviewer.html', feedback=feedback, resume_text=resume_text)
            
        except openai.APIError as e:
            return render_template('reviewer.html', error=f"AI service error: {str(e)}")
        except Exception as e:
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
        
        # Validate file type and size
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
            pdf_reader = PyPDF2.PdfReader(file)
            for page in pdf_reader.pages:
                text_content += page.extract_text() + "\n"
                
        elif file_ext in ['.doc', '.docx']:
            doc = docx.Document(file)
            for paragraph in doc.paragraphs:
                text_content += paragraph.text + "\n"
        
        if not text_content.strip():
            return jsonify({'error': 'Could not extract text from the file. Please try a different file or paste the text manually.'}), 400
        
        return jsonify({
            'status': 'success',
            'text': text_content.strip(),
            'filename': secure_filename(file.filename)
        })
        
    except Exception as e:
        return jsonify({'error': f'Error processing file: {str(e)}'}), 500


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
        
        if not section or not content:
            return jsonify({'error': 'Section and content are required'}), 400
        
        if len(content) > 2000:
            return jsonify({'error': 'Content too long. Please limit to 2000 characters.'}), 400
        
        # Enhanced prompts for different sections
        prompts = {
            'summary': f"""Rewrite this professional summary for a resume. Make it:
            - Compelling and results-oriented
            - 2-3 sentences maximum
            - Include relevant keywords for {job_title if job_title else 'professional roles'}
            - Quantify achievements where possible
            
            Original: {content}""",
            
            'experience': f"""Rewrite this work experience description. Make it:
            - Use strong action verbs (Led, Achieved, Implemented, etc.)
            - Include specific metrics and results
            - ATS-friendly with relevant keywords
            - 2-4 bullet points maximum
            - Tailored for {job_title if job_title else 'professional roles'}
            
            Original: {content}""",
            
            'education': f"""Rewrite this education section. Include:
            - Relevant coursework, honors, or achievements
            - GPA if 3.5 or higher
            - Any relevant projects or certifications
            
            Original: {content}""",
            
            'skills': f"""Organize these skills effectively. Make them:
            - Relevant to {job_title if job_title else 'professional roles'}
            - Grouped by category if appropriate
            - Include both technical and soft skills
            - ATS-optimized keywords
            
            Original: {content}"""
        }
        
        prompt = prompts.get(section, f"Improve this {section} section for a professional resume: {content}")
        
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a professional resume writer specializing in ATS-optimized content and modern hiring practices."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=250,
            temperature=0.4
        )
        
        suggestion = response.choices[0].message.content.strip()
        return jsonify({'suggestion': suggestion})
        
    except openai.APIError as e:
        return jsonify({'error': f'AI service error: {str(e)}'}), 502
    except Exception as e:
        return jsonify({'error': f'Error generating suggestion: {str(e)}'}), 500

@app.route('/export_pdf', methods=['POST'])
def export_pdf():
    try:
        resume_data = request.json
        if not resume_data:
            return jsonify({'error': 'No resume data provided'}), 400
        
        # Create PDF in memory
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
        
        # Styles
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=18,
            textColor=colors.HexColor('#1e40af'),
            alignment=1,  # Center
            spaceAfter=12
        )
        
        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=12,
            textColor=colors.HexColor('#1e40af'),
            spaceAfter=6,
            borderWidth=1,
            borderColor=colors.HexColor('#1e40af'),
            borderPadding=3
        )
        
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
        
        # Contact Info
        contact_info = []
        if resume_data.get('email'):
            contact_info.append(resume_data['email'])
        if resume_data.get('phone'):
            contact_info.append(resume_data['phone'])
        if resume_data.get('location'):
            contact_info.append(resume_data['location'])
        
        if contact_info:
            story.append(Paragraph(' | '.join(contact_info), normal_style))
            story.append(Spacer(1, 12))
        
        # Summary
        if resume_data.get('summary'):
            story.append(Paragraph('PROFESSIONAL SUMMARY', heading_style))
            story.append(Paragraph(resume_data['summary'], normal_style))
            story.append(Spacer(1, 12))
        
        # Experience
        if resume_data.get('experience'):
            story.append(Paragraph('WORK EXPERIENCE', heading_style))
            story.append(Paragraph(resume_data['experience'], normal_style))
            story.append(Spacer(1, 12))
        
        # Education
        if resume_data.get('education'):
            story.append(Paragraph('EDUCATION', heading_style))
            story.append(Paragraph(resume_data['education'], normal_style))
            story.append(Spacer(1, 12))
        
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
            download_name=f"{name.replace(' ', '_')}_Resume.pdf",
            mimetype='application/pdf'
        )
        
    except Exception as e:
        return jsonify({'error': f'Error generating PDF: {str(e)}'}), 500

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
