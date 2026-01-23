from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
from app.core.config import settings

import smtplib
import ssl
from email.message import EmailMessage


app = FastAPI(title=settings.APP_NAME, version=settings.APP_VERSION)

origins = settings.cors_allow_origins_list
if origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

@app.get("/health")
def health():
    return {"ok": True}


# ====== Contact API ======
EMAIL_TO = "edricding0108@gmail.com"  # <-- constant receiver


class ContactPayload(BaseModel):
    name: str = Field(min_length=1)
    email: str = Field(min_length=1)
    message: str = Field(min_length=1)
    phone: Optional[str] = None


def send_contact_email(payload: ContactPayload) -> None:
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        raise RuntimeError("SMTP_USER/SMTP_PASSWORD not configured")

    phone_value = payload.phone.strip() if payload.phone and payload.phone.strip() else "-"

    subject = f"New message from {payload.name}"
    body = (
        f"Name: {payload.name}\n"
        f"Email: {payload.email}\n"
        f"Phone: {phone_value}\n\n"
        f"Message:\n{payload.message}\n"
    )

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["To"] = EMAIL_TO
    msg["From"] = settings.SMTP_FROM.strip() if settings.SMTP_FROM else settings.SMTP_USER
    msg["Reply-To"] = payload.email  # 方便你直接点回复就是对方
    msg.set_content(body)

    context = ssl.create_default_context()

    # 587: STARTTLS, 465: SSL
    if int(settings.SMTP_PORT) == 465:
        with smtplib.SMTP_SSL(settings.SMTP_HOST, int(settings.SMTP_PORT), context=context) as server:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
    else:
        with smtplib.SMTP(settings.SMTP_HOST, int(settings.SMTP_PORT)) as server:
            server.ehlo()
            server.starttls(context=context)
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)


@app.post("/api/contact")
def contact(payload: ContactPayload):
    try:
        send_contact_email(payload)
        return {"ok": True}
    except Exception as e:
        # 生产环境你也可以换成日志记录 e，这里先返回统一错误
        raise HTTPException(status_code=500, detail="Failed to send email")
