import os
import boto3
from botocore.config import Config

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = boto3.client(
            "s3",
            endpoint_url=os.environ["R2_ENDPOINT_URL"],
            aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
            aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
            config=Config(signature_version="s3v4"),
            region_name="auto",
        )
    return _client


def upload_pdf(file_bytes: bytes, r2_key: str) -> str:
    bucket = os.environ["R2_BUCKET_NAME"]
    _get_client().put_object(
        Bucket=bucket,
        Key=r2_key,
        Body=file_bytes,
        ContentType="application/pdf",
    )
    return r2_key


def get_presigned_url(r2_key: str, expires_in: int = 3600) -> str:
    bucket = os.environ["R2_BUCKET_NAME"]
    return _get_client().generate_presigned_url(
        "get_object",
        Params={
            "Bucket": bucket,
            "Key": r2_key,
            "ResponseContentType": "application/pdf",
            "ResponseContentDisposition": "inline",
        },
        ExpiresIn=expires_in,
    )
