"""
Matching Service

AI-powered service for matching candidates to jobs using Gemini.
Provides semantic similarity scoring and ranking.
"""

import json
from typing import List, Dict, Optional, Tuple
from sqlmodel import Session, select

from services.gemini_service import get_gemini_model
from models.job import JobRequisition, JobCriteria, JobKeyword
from models.application import Application
from models.resume import Resume


def calculate_match_score(
    session: Session,
    job_id: int,
    resume_id: int
) -> Tuple[int, Dict]:
    """
    Calculate match score algorithmic-ally (No LLM prompt).
    """
    job = session.get(JobRequisition, job_id)
    if not job:
        raise ValueError("Job not found")
    
    resume = session.get(Resume, resume_id)
    if not resume:
        raise ValueError("Resume not found")
        
    criteria = session.exec(select(JobCriteria).where(JobCriteria.job_id == job_id)).all()
    keywords = session.exec(select(JobKeyword).where(JobKeyword.job_id == job_id)).all()
    
    # 1. Parse Applicant's previously extracted JSON skills
    extracted_skills_list = []
    try:
        extracted_skills_list = json.loads(resume.extracted_skills) if resume.extracted_skills else []
        if isinstance(extracted_skills_list, dict): 
            extracted_skills_list = extracted_skills_list.get("skills", [])
    except:
        extracted_skills_list = []
        
    # We'll normalize arrays for easy intersection
    applicant_skills = {s.lower().strip() for s in extracted_skills_list}
    
    # 2. Score Skills & Keywords
    skills_score = 0
    keywords_matched = []
    missing_requirements = []
    
    # Job Criteria scoring (Weight 0-10)
    total_criteria_weight = sum(c.weight for c in criteria) if criteria else 0
    earned_weight = 0
    
    for req in criteria:
        if req.skill_name.lower().strip() in applicant_skills:
            earned_weight += req.weight
            keywords_matched.append(req.skill_name)
        else:
            if req.is_must_have:
                missing_requirements.append(req.skill_name)
                
    if total_criteria_weight > 0:
        skills_score = int((earned_weight / total_criteria_weight) * 100)
    else:
        skills_score = 50 # Default if no criteria
    
    # Simple Keyword matching
    job_keywords = {k.keyword.lower().strip() for k in keywords}
    for kw in job_keywords:
        if kw in applicant_skills and kw not in {k.lower() for k in keywords_matched}:
            keywords_matched.append(kw)
    
    # 3. Score Experience
    exp_score = 50
    if job.experience_level and resume.experience_years:
        try:
            # simple extract integer if string, e.g. "Senior (5+ years)" -> 5
            import re
            required_years = 0
            nums = re.findall(r'\d+', str(job.experience_level))
            if nums: required_years = int(nums[0])
            
            if resume.experience_years >= required_years:
                exp_score = 100
            elif resume.experience_years >= (required_years - 2):
                exp_score = 75
            else:
                exp_score = 40
        except:
            pass

    overall_score = int((skills_score * 0.7) + (exp_score * 0.3))
    
    recommendation = "weak_match"
    if overall_score > 80: recommendation = "strong_match"
    elif overall_score > 65: recommendation = "good_match"
    elif overall_score > 45: recommendation = "partial_match"

    breakdown = {
        "skills_score": skills_score,
        "experience_score": exp_score,
        "education_score": 50, # Stub for phase 2
        "keywords_matched": keywords_matched,
        "missing_requirements": missing_requirements,
        "strengths": [f"Matched {len(keywords_matched)} key skills."][:2],
        "recommendation": recommendation
    }
    
    return overall_score, breakdown


def get_matched_candidates(
    session: Session,
    job_id: int,
    min_score: int = 0,
    limit: int = 20
) -> List[Dict]:
    """
    Get candidates matched to a job, ranked by score.
    
    Args:
        job_id: Job requisition ID
        min_score: Minimum match score to include
        limit: Maximum number of candidates to return
    """
    # Get all applications for this job
    applications = session.exec(
        select(Application)
        .where(Application.job_id == job_id)
        .order_by(Application.match_score.desc())
        .limit(limit)
    ).all()
    
    results = []
    for app in applications:
        if app.match_score is not None and app.match_score >= min_score:
            results.append({
                "application_id": app.id,
                "candidate_id": app.candidate_id,
                "candidate_name": app.candidate.username if app.candidate else "Unknown",
                "resume_id": app.resume_id,
                "match_score": app.match_score,
                "score_breakdown": json.loads(app.score_breakdown) if app.score_breakdown else None,
                "status": app.status.value,
                "applied_at": app.applied_at.isoformat()
            })
    
    return results


def score_application(
    session: Session,
    application_id: int
) -> Dict:
    """
    Calculate and store match score for an application.
    """
    application = session.get(Application, application_id)
    if not application:
        raise ValueError("Application not found")
    
    if not application.resume_id:
        return {
            "application_id": application_id,
            "match_score": None,
            "error": "No resume attached to application"
        }
    
    # Calculate score
    score, breakdown = calculate_match_score(
        session,
        application.job_id,
        application.resume_id
    )
    
    # Store in application
    application.match_score = score
    application.score_breakdown = json.dumps(breakdown)
    session.add(application)
    session.commit()
    session.refresh(application)
    
    return {
        "application_id": application_id,
        "match_score": score,
        "breakdown": breakdown
    }


def batch_score_applications(
    session: Session,
    job_id: int
) -> List[Dict]:
    """
    Score all unscored applications for a job.
    """
    applications = session.exec(
        select(Application)
        .where(Application.job_id == job_id)
        .where(Application.match_score == None)
    ).all()
    
    results = []
    for app in applications:
        try:
            result = score_application(session, app.id)
            results.append(result)
        except Exception as e:
            results.append({
                "application_id": app.id,
                "error": str(e)
            })
    
    return results


def get_job_ai_summary(session: Session, job_id: int) -> str:
    """
    Takes the Top 10 algorithmically ranked candidates and sends their stats to Gemini 
    for a 2-paragraph summary.
    """
    job = session.get(JobRequisition, job_id)
    if not job:
        raise ValueError("Job not found")
        
    candidates = get_matched_candidates(session, job_id, limit=10)
    if not candidates:
        return "No applicants to summarize for this job yet."
        
    # Construct lightweight metadata string for Gemini
    cand_strings = []
    for rank, c in enumerate(candidates, 1):
        score = c.get("match_score", 0)
        bd = c.get("score_breakdown", {})
        skills_matched = bd.get("keywords_matched", []) if bd else []
        exp = bd.get("experience_score", 0) if bd else 0
        cand_strings.append(f"Rank {rank}: {c.get('candidate_name')} - Score {score}. "
                            f"Matched Skills: {', '.join(skills_matched)}. Exp Score: {exp}.")
        
    prompt = f"""
You are an expert HR recruiter. Summarize the top talent pool for this job.
Do not use Markdown lists, write a concise 2-paragraph summary.

JOB TITLE: {job.title}

TOP APPLICANTS METADATA:
{chr(10).join(cand_strings)}

Write a professional summary outlining the overall quality of this talent pool, 
and explicitly mention why the top 1 or 2 candidates stand out based on their matched skills.
"""
    model = get_gemini_model()
    try:
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        return f"Failed to generate summary: {str(e)}"
