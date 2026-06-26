import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from controllers.auth_controller import router as auth_router
from controllers.admin_controller import router as admin_router
from controllers.document_controller import router as document_router

load_dotenv()

app = FastAPI(title="Multitenant App")

_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(document_router)


@app.get("/")
def root():
    return {"status": "ok"}
