import os
from flask import Flask, render_template, request, jsonify, session
from flask_session import Session
from flask_cors import CORS
import openai

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "dev_secret_key_change_in_production")
app.config['SESSION_TYPE'] = 'filesystem'
Session(app)
CORS(app, supports_credentials=True)

# Updated OpenAI client initialization
client = openai.OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/templates')
def templates():
    return render_template('template_chooser.html')

@app.route('/builder', methods=['GET', 'POST'])
def builder():
    if request.method == 'POST':
        # Handle resume data saving
        session['resume_data'] = request.json
        return jsonify({'status': 'success', 'message': 'Resume saved successfully'})
    return render_template('builder.html')

@app.route('/reviewer', methods=['GET', 'POST'])
def reviewer():
    if request.method == 'POST':
        resume_text = request.form.get('resume_text')
        if not resume_text:
            return render_template('reviewer.html', error="Please provide resume text to review")
        
        try:
            # Updated OpenAI API call
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are an expert resume reviewer. Analyze resumes for ATS compatibility, keyword usage, strengths, weaknesses, and improvements."},
                    {"role": "user", "content": f"Analyze this resume:\n{resume_text}"}
                ],
                max_tokens=500,
                temperature=0.7
            )
            feedback = response.choices[0].message.content
            return render_template('reviewer.html', feedback=feedback, resume_text=resume_text)
        except Exception as e:
            return render_template('reviewer.html', error=f"Error analyzing resume: {str(e)}")
    
    return render_template('reviewer.html')

@app.route('/ai_suggest', methods=['POST'])
def ai_suggest():
    try:
        data = request.json
        section = data.get('section')
        content = data.get('content')
        job_title = data.get('job_title', '')
        
        prompt = f"""Rewrite this {section} section for a resume. Make it:
        - ATS-friendly with relevant keywords
        - Action-oriented with strong verbs
        - Quantified with metrics where possible
        - Tailored for {job_title if job_title else 'professional roles'}
        
        Original content: {content}"""
        
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a professional resume writer specializing in ATS-optimized content."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=200,
            temperature=0.7
        )
        
        suggestion = response.choices[0].message.content
        return jsonify({'suggestion': suggestion})
    
    except Exception as e:
        return jsonify({'error': f"Error generating suggestion: {str(e)}"})

@app.route('/export_pdf', methods=['POST'])
def export_pdf():
    # Placeholder for PDF export functionality
    resume_data = request.json
    # You can implement PDF generation using libraries like reportlab or weasyprint
    return jsonify({'status': 'success', 'message': 'PDF export feature coming soon!'})

if __name__ == '__main__':
    app.run(debug=True)
