import json
import os
import smtplib
from pathlib import Path
from email.header import Header
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import FastAPI, HTTPException, Request as FastAPIRequest
from pydantic import BaseModel, Field
from fastapi.middleware.cors import CORSMiddleware
from jinja2 import Environment, FileSystemLoader, select_autoescape
import bcrypt
import pymysql
from pymysql.err import IntegrityError

from app.core.config import settings

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

class ContactPayload(BaseModel):
    name: str
    email: str
    message: str
    phone: str | None = None
    captcha_token: str


class CreateUserPayload(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1, max_length=255)
    role: str | None = None

EMAIL_TO = "edricding0108@gmail.com"  # 固定收件人

# --- Jinja2 模板加载（模板放在 app/templates/contact_email.html） ---
TEMPLATES_DIR = Path(__file__).resolve().parent / "templates"
jinja_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html", "xml"])
)

def render_contact_html(name: str, email: str, phone: str, message: str) -> str | None:
    """
    渲染 HTML 邮件模板。
    如果模板文件不存在/渲染失败，返回 None（会 fallback 到纯文本）。
    """
    try:
        template = jinja_env.get_template("contact_email.html")
        return template.render(name=name, email=email, phone=phone, message=message)
    except Exception:
        return None

def verify_recaptcha(token: str, remoteip: str | None = None) -> None:
    secret = os.getenv("RECAPTCHA_SECRET_KEY", "").strip()
    if not secret:
        raise HTTPException(status_code=500, detail="RECAPTCHA_SECRET_KEY not configured")
    if not token:
        raise HTTPException(status_code=400, detail="Captcha token missing")

    payload = {"secret": secret, "response": token}
    if remoteip:
        payload["remoteip"] = remoteip

    req = Request(
        "https://www.google.com/recaptcha/api/siteverify",
        data=urlencode(payload).encode("utf-8"),
        method="POST",
    )
    try:
        with urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"reCAPTCHA verify failed: {exc}")

    if not result.get("success"):
        raise HTTPException(status_code=400, detail="Captcha verification failed")


def get_db_connection():
    db_host = os.getenv("DB_HOST", "mysql")
    db_port = int(os.getenv("DB_PORT", "3306"))
    db_name = os.getenv("DB_NAME", "edricd")
    db_user = os.getenv("DB_USER", "edricd")
    db_password = os.getenv("DB_PASSWORD", "")

    return pymysql.connect(
        host=db_host,
        port=db_port,
        user=db_user,
        password=db_password,
        database=db_name,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=True,
    )


def hash_password(plain_password: str) -> str:
    return bcrypt.hashpw(
        plain_password.encode("utf-8"),
        bcrypt.gensalt(),
    ).decode("utf-8")

@app.get("/api/health")
def health():
    return {"ok": True}

@app.get("/api/recaptcha-sitekey")
def recaptcha_sitekey():
    site_key = os.getenv("RECAPTCHA_SITE_KEY", "").strip()
    return {"site_key": site_key}


@app.post("/api/users/create")
def create_user(payload: CreateUserPayload):
    username = payload.username.strip()
    plain_password = payload.password

    if not username:
        return {"success": False, "message": "username is required"}
    if not plain_password or not plain_password.strip():
        return {"success": False, "message": "password is required"}

    hashed_password = hash_password(plain_password)

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO `user` (`username`, `password`, `last_login_time`)
                    VALUES (%s, %s, NULL)
                    """,
                    (username, hashed_password),
                )
                new_id = cursor.lastrowid

        return {"success": True, "message": "user created", "data": {"id": new_id}}
    except IntegrityError as exc:
        # 1062 = duplicate entry for unique key
        if exc.args and len(exc.args) > 0 and exc.args[0] == 1062:
            return {"success": False, "message": "username already exists"}
        return {"success": False, "message": f"database integrity error: {exc}"}
    except Exception as exc:
        return {"success": False, "message": f"create user failed: {exc}"}

@app.post("/api/contact")
def contact(payload: ContactPayload, request: FastAPIRequest):
    smtp_host = os.getenv("SMTP_HOST", "")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASS", "")

    if not smtp_host or not smtp_user or not smtp_pass:
        raise HTTPException(status_code=500, detail="SMTP env not configured")

    client_ip = request.client.host if request.client else None
    verify_recaptcha(payload.captcha_token, client_ip)

    phone = payload.phone.strip() if payload.phone and payload.phone.strip() else "-"

    subject = f"[edricd.com] New Contact Form - {payload.name}"

    # 纯文本版本（永远存在）
    text_body = (
        f"name: {payload.name}\n"
        f"email: {payload.email}\n"
        f"phone: {phone}\n"
        f"message:\n{payload.message}\n"
    )

    # HTML 版本（如果模板存在就用）
    html_body = render_contact_html(
        name=payload.name,
        email=payload.email,
        phone=phone,
        message=payload.message,
    )

    # 组合邮件：plain + html（推荐）
    msg = MIMEMultipart("alternative")
    msg["Subject"] = Header(subject, "utf-8")
    msg["From"] = smtp_user
    msg["To"] = EMAIL_TO

    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    if html_body:
        msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, [EMAIL_TO], msg.as_string())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SMTP send failed: {e}")

    return {"ok": True}
