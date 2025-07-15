import os
from flask import Flask, render_template, request, jsonify, session
from flask_session import Session
from flask_cors import CORS
import openai

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "dev_secret")
app.config['SESSION_TYPE'] = 'filesystem'
Session(app)
CORS(app, supports_credentials=True)

openai.api_key = os.environ.get("OPENAI_API_KEY")

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/templates')
def templates():
    return render_template('template_chooser.html')

@app.route('/builder', methods=['GET', 'POST'])
def builder():
    if request.method == 'POST':
        # Placeholder for save/export POST
        pass
    return render_template('builder.html')

@app.route('/reviewer', methods=['GET', 'POST'])
def reviewer():
    if request.method == 'POST':
        resume_text = request.form.get('resume_text')
        review_prompt = f"Analyze and review this resume for ATS compatibility, keyword usage, strengths, weaknesses, missing sections, and suggest improvements:\n{resume_text}"
        response = openai.Completion.create(
            model="text-davinci-003",
            prompt=review_prompt,
            max_tokens=300)
        feedback = response.choices[0].text.strip()
        return render_template('reviewer.html', feedback=feedback, resume_text=resume_text)
    return render_template('reviewer.html')

@app.route('/ai_suggest', methods=['POST'])
def ai_suggest():
    data = request.json
    section = data.get('section')
    content = data.get('content')
    prompt = f"Rewrite this for a {section} section in a resume. Make it concise, results-oriented, and keyword-optimized:\n{content}"
    response = openai.Completion.create(
        model="text-davinci-003",
        prompt=prompt,
        max_tokens=120)
    suggestion = response.choices[0].text.strip()
    return jsonify({'suggestion': suggestion})

if __name__ == '__main__':
    app.run(debug=True)

