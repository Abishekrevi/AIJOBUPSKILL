from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from datetime import datetime
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
import uuid

router = APIRouter()

class EmailData(BaseModel):
    to_email: str
    subject: str
    body: str
    worker_id: str = None

SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SENDER_EMAIL = os.getenv("SENDER_EMAIL")
SENDER_PASSWORD = os.getenv("SENDER_PASSWORD")

async def send_email(email: EmailData):
    try:
        if not SENDER_EMAIL or not SENDER_PASSWORD:
            print("Email credentials not configured")
            return
        
        msg = MIMEMultipart()
        msg['From'] = SENDER_EMAIL
        msg['To'] = email.to_email
        msg['Subject'] = email.subject
        msg.attach(MIMEText(email.body, 'html'))
        
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.send_message(msg)
        
        print(f"? Email sent to {email.to_email}")
    except Exception as e:
        print(f"? Email failed: {e}")

@router.post("/send-notification")
async def send_notification(email: EmailData, background_tasks: BackgroundTasks):
    background_tasks.add_task(send_email, email)
    return {"success": True, "message": "Notification queued"}

@router.post("/send-milestone-email")
async def send_milestone_email(worker_id: str, worker_email: str, milestone_type: str, worker_name: str, background_tasks: BackgroundTasks):
    milestones = {
        "first_credential": {
            "subject": "?? Congratulations on Your First Credential!",
            "body": f"<h2>Great job, {worker_name}!</h2><p>You've completed your first credential. Keep it up!</p>"
        },
        "five_credentials": {
            "subject": "?? 5 Credentials Complete!",
            "body": f"<h2>Amazing, {worker_name}!</h2><p>You've earned 5 credentials. You're on fire!</p>"
        }
    }
    
    email_data = milestones.get(milestone_type)
    if email_data:
        background_tasks.add_task(
            send_email,
            EmailData(
                to_email=worker_email,
                subject=email_data["subject"],
                body=email_data["body"],
                worker_id=worker_id
            )
        )
    
    return {"success": True, "message": "Email queued"}
