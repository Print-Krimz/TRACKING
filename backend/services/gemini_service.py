"""
Gemini AI Service

Integration with Google's Gemini API for resume analysis.
This service handles all AI-powered resume analysis functionality.

Features:
- Resume text analysis
- Strength/weakness identification
- Score generation
- Structured feedback formatting

Security Note:
- The API key is loaded from environment variables
- Never commit API keys to version control
"""

import os
import json
from typing import Optional

from dotenv import load_dotenv
import google.generativeai as genai

# Load environment variables
load_dotenv()

# Configure the Gemini API with the key from environment
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Initialize the Gemini client if API key is available
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


def get_gemini_model():
    """
    Get a configured Gemini model instance.
    
    Returns:
        GenerativeModel: A configured Gemini Pro model instance
    
    Raises:
        ValueError: If GEMINI_API_KEY is not configured
    """
    if not GEMINI_API_KEY:
        raise ValueError(
            "GEMINI_API_KEY not configured. "
            "Please set it in your .env file."
        )
    
    # Using Gemini Pro for text analysis
    # This model is optimized for text generation and analysis
    return genai.GenerativeModel('gemini-flash-latest')


def analyze_resume(
    content: str,
    job_role: str = "software engineer",
    additional_context: Optional[str] = None
) -> str:
    """
    Analyze a resume using the Gemini AI API.
    
    This function sends the resume content to Gemini with a structured
    prompt, requesting:
    - Overall score (1-10)
    - Key strengths
    - Areas for improvement
    - Summary assessment
    - Recommendations
    
    Args:
        content: The full resume text to analyze
        job_role: The target job role for context (default: "software engineer")
        additional_context: Any additional requirements or context
    
    Returns:
        str: JSON-formatted analysis result containing:
            - score: Integer 1-10
            - strengths: List of strength points
            - weaknesses: List of areas to improve
            - summary: Overall assessment paragraph
            - recommendations: Actionable improvement suggestions
    
    Raises:
        ValueError: If Gemini API key is not configured
        Exception: If Gemini API call fails
    
    Example:
        result = analyze_resume(resume_text, "data scientist")
        analysis = json.loads(result)
        print(f"Score: {analysis['score']}/10")
    """
    model = get_gemini_model()
    
    # Build the analysis prompt
    # The prompt is structured to get consistent, parseable output
    prompt = f"""
You are an expert HR professional and resume analyst. Analyze the following resume 
for a {job_role} position and provide a detailed assessment.

RESUME CONTENT:
{content}

{f"ADDITIONAL CONTEXT: {additional_context}" if additional_context else ""}

Please provide your analysis in the following JSON format:
{{
    "score": <integer from 1-10>,
    "strengths": [
        "<strength 1>",
        "<strength 2>",
        "<strength 3>"
    ],
    "weaknesses": [
        "<area for improvement 1>",
        "<area for improvement 2>"
    ],
    "summary": "<2-3 sentence overall assessment>",
    "recommendations": [
        "<specific actionable recommendation 1>",
        "<specific actionable recommendation 2>",
        "<specific actionable recommendation 3>"
    ]
}}

IMPORTANT: 
- The resume has been anonymized to remove personal information. Ignore any [REDACTED] placeholders.
- Do NOT reference or attempt to infer the candidate's name, email, phone, or address.
- Focus ONLY on professional qualifications, skills, experience, and education.
- Be specific and constructive in your feedback
- Consider both technical skills and soft skills
- Evaluate formatting, clarity, and professionalism
- Score fairly: 1-3 (needs significant work), 4-6 (average), 7-8 (strong), 9-10 (exceptional)
- Return ONLY the JSON object, no additional text

Analyze the resume now:
"""
    
    try:
        # Generate the analysis using Gemini
        response = model.generate_content(prompt)
        
        # Extract the response text
        analysis_text = response.text
        
        # Try to clean up the response if it contains markdown code blocks
        if "```json" in analysis_text:
            # Extract JSON from markdown code block
            start = analysis_text.find("```json") + 7
            end = analysis_text.find("```", start)
            analysis_text = analysis_text[start:end].strip()
        elif "```" in analysis_text:
            # Generic code block
            start = analysis_text.find("```") + 3
            end = analysis_text.find("```", start)
            analysis_text = analysis_text[start:end].strip()
        
        # Validate that we got valid JSON
        try:
            parsed = json.loads(analysis_text)
            # Ensure required fields exist
            required_fields = ["score", "strengths", "weaknesses", "summary", "recommendations"]
            for field in required_fields:
                if field not in parsed:
                    parsed[field] = [] if field in ["strengths", "weaknesses", "recommendations"] else "N/A"
            
            return json.dumps(parsed, indent=2)
        except json.JSONDecodeError:
            # If response isn't valid JSON, wrap it in a basic structure
            return json.dumps({
                "score": 5,
                "strengths": ["Analysis completed"],
                "weaknesses": ["Could not parse structured feedback"],
                "summary": analysis_text[:500] if len(analysis_text) > 500 else analysis_text,
                "recommendations": ["Please try again for structured feedback"]
            }, indent=2)
            
    except Exception as e:
        # Log the error and return a fallback response
        error_message = str(e)
        return json.dumps({
            "score": 0,
            "strengths": [],
            "weaknesses": [],
            "summary": f"Analysis failed: {error_message}",
            "recommendations": ["Please check your Gemini API configuration and try again"],
            "error": True
        }, indent=2)


def extract_resume_metadata(content: str) -> dict:
    """
    Extract structured skills and generic years of experience from a resume.
    Executed ONCE during resume upload.
    """
    model = get_gemini_model()
    
    prompt = f"""
Extract the core skills and total years of professional experience from this resume.

RESUME CONTENT:
{content}

Return ONLY a valid JSON object matching this schema:
{{
    "skills": ["Python", "React", "Project Management", "etc"],
    "experience_years": <integer representing total years of experience, e.g. 5. If unknown, use 0>
}}
"""
    try:
        response = model.generate_content(prompt)
        text = response.text.strip()
        
        if "```json" in text:
            start = text.find("```json") + 7
            end = text.find("```", start)
            text = text[start:end].strip()
        elif "```" in text:
            start = text.find("```") + 3
            end = text.find("```", start)
            text = text[start:end].strip()
            
        return json.loads(text)
    except Exception as e:
        return {"skills": [], "experience_years": 0}


def test_gemini_connection() -> bool:
    """
    Test if the Gemini API connection is working.
    
    Returns:
        bool: True if connection is successful, False otherwise
    """
    try:
        model = get_gemini_model()
        response = model.generate_content("Say 'OK' if you can read this.")
        return "OK" in response.text.upper()
    except Exception:
        return False
