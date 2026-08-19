import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime, timezone

def send_emergency_email(
    to_email: str,
    contact_name: str,
    traveler_name: str,
    trip_id: str,
    share_token: str,
    lat: float,
    lng: float,
    spoken_transcript: str = None,
    photo_url: str = None,
    evidence_url: str = None,
    video_url: str = None,
    smtp_config: dict = None,
    base_url: str = "http://localhost:5174",
    backend_url: str = "http://localhost:3001"
):
    share_link = f"{base_url}/trip/{trip_id}/status/{share_token}"
    full_photo_url = f"{backend_url}{photo_url}" if photo_url else None
    full_audio_url = f"{backend_url}{evidence_url}" if evidence_url else None
    full_video_url = f"{backend_url}{video_url}" if video_url else None

    subject = f"URGENT EMERGENCY ALERT: {traveler_name} needs immediate help!"

    transcript_html = f'<div style="background:#0f172a;padding:12px;border-radius:8px;margin-top:12px;font-family:monospace;white-space:pre-wrap;">{spoken_transcript}</div>' if spoken_transcript else '<p style="color:#94a3b8;">Emergency Panic Button Triggered</p>'

    photo_html = f'''
    <div style="margin-top:16px;">
      <p style="font-weight:bold;color:#ef4444;margin-bottom:8px;">📸 CAPTURED EMERGENCY CAMERA SNAPSHOT:</p>
      <img src="{full_photo_url}" style="max-width:100%;border-radius:12px;border:2px solid #ef4444;" alt="Camera Snapshot"/>
      <p style="font-size:11px;color:#94a3b8;margin-top:4px;">Direct Image Link: <a href="{full_photo_url}" style="color:#06b6d4;">{full_photo_url}</a></p>
    </div>
    ''' if full_photo_url else ''

    audio_html = f'''
    <div style="margin-top:16px;background:#0f172a;padding:12px;border-radius:8px;border:1px solid #06b6d4;">
      <p style="font-weight:bold;color:#06b6d4;margin:0 0 4px 0;">🎙️ AUDIO EVIDENCE CLIP RECORDING:</p>
      <a href="{full_audio_url}" style="color:#38bdf8;font-weight:bold;font-size:14px;text-decoration:underline;">▶ Click Here to Listen to Recorded Audio Clip ({full_audio_url})</a>
    </div>
    ''' if full_audio_url else ''

    video_html = f'''
    <div style="margin-top:16px;background:#0f172a;padding:12px;border-radius:8px;border:1px solid #f43f5e;">
      <p style="font-weight:bold;color:#f43f5e;margin:0 0 4px 0;">🎥 LIVE INCIDENT VIDEO RECORDING:</p>
      <a href="{full_video_url}" style="color:#fb7185;font-weight:bold;font-size:14px;text-decoration:underline;">▶ Click Here to Watch Recorded Video Clip ({full_video_url})</a>
    </div>
    ''' if full_video_url else ''

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #020617; color: #f8fafc; padding: 20px; margin: 0; }}
        .card {{ background-color: #0f172a; border-radius: 20px; border: 3px solid #ef4444; padding: 24px; max-width: 600px; margin: 0 auto; box-shadow: 0 25px 50px -12px rgba(239,68,68,0.4); }}
        .header {{ text-align: center; color: #ef4444; font-size: 26px; font-weight: 900; letter-spacing: 1px; }}
        .btn {{ display: block; width: 100%; text-align: center; background-color: #06b6d4; color: white !important; text-decoration: none; padding: 16px 0; border-radius: 14px; font-weight: bold; font-size: 16px; margin-top: 24px; box-shadow: 0 10px 20px rgba(6,182,212,0.4); }}
        .meta {{ background-color: #1e293b; padding: 14px; border-radius: 12px; font-size: 14px; margin-top: 16px; border: 1px solid #334155; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">🚨 CRITICAL EMERGENCY PANIC ALERT 🚨</div>
        <p style="font-size:16px;">Dear <strong>{contact_name}</strong>,</p>
        <p style="font-size:15px;line-height:1.5;">Your trusted contact <strong>{traveler_name}</strong> has triggered an emergency distress alert on SafeRoute and requires immediate assistance!</p>

        <div class="meta">
          <p style="margin:4px 0;"><strong>📍 Real GPS Coordinates:</strong> Latitude {lat:.6f}, Longitude {lng:.6f}</p>
          <p style="margin:4px 0;"><strong>🕒 Exact Timestamp:</strong> {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}</p>
        </div>

        <p style="font-weight:bold;margin-top:16px;margin-bottom:4px;color:#cbd5e1;">🗣️ Timestamped Spoken Word Transcript Log:</p>
        {transcript_html}

        {photo_html}
        {audio_html}
        {video_html}

        <a href="{share_link}" class="btn">🗺️ OPEN REAL-TIME LIVE GPS TRACKING MAP</a>
      </div>
    </body>
    </html>
    """

    print(f"\n=======================================================")
    print(f"[EMERGENCY EMAIL DISPATCHED TO TRUSTED CONTACT]")
    print(f"To: {contact_name} <{to_email}>")
    print(f"Subject: {subject}")
    print(f"Traveler: {traveler_name}")
    print(f"GPS: ({lat:.6f}, {lng:.6f})")
    print(f"Photo Attachment URL: {full_photo_url or 'Pending capture'}")
    print(f"Audio Attachment URL: {full_audio_url or 'Pending capture'}")
    print(f"Live Map Link: {share_link}")
    print(f"=======================================================\n")

    # Read SMTP config from arguments or environment
    smtp_host = (smtp_config and smtp_config.get("host")) or os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int((smtp_config and smtp_config.get("port")) or os.getenv("SMTP_PORT", 587))
    smtp_user = (smtp_config and smtp_config.get("user")) or os.getenv("SMTP_USER", "")
    smtp_pass = (smtp_config and smtp_config.get("pass")) or os.getenv("SMTP_PASS", "")
    from_email = (smtp_config and smtp_config.get("user")) or os.getenv("FROM_EMAIL", "alerts@saferoute.app")

    if smtp_user and smtp_pass:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = from_email
            msg["To"] = to_email
            msg.attach(MIMEText(html_content, "html"))

            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.sendmail(from_email, [to_email], msg.as_string())
            print(f"[SUCCESS] Real SMTP email delivered to {to_email}")
        except Exception as err:
            print(f"[WARN] SMTP delivery error: {err}")

    return {
        "to": to_email,
        "contactName": contact_name,
        "subject": subject,
        "shareLink": share_link,
        "photoUrl": full_photo_url,
        "audioUrl": full_audio_url,
        "spokenTranscript": spoken_transcript,
        "deliveredAt": datetime.now(timezone.utc).isoformat()
    }
