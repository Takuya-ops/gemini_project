import base64
from email.mime.text import MIMEText
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials


def get_gmail_service(credentials: Credentials):
    return build("gmail", "v1", credentials=credentials)


def send_email(
    credentials: Credentials,
    to: str,
    subject: str,
    body: str,
) -> dict:
    service = get_gmail_service(credentials)

    message = MIMEText(body, "plain", "utf-8")
    message["to"] = to
    message["subject"] = subject

    raw = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
    sent = service.users().messages().send(
        userId="me",
        body={"raw": raw},
    ).execute()

    return {"message_id": sent["id"], "to": to}
